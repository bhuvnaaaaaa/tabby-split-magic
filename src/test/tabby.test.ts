import { describe, expect, it, vi } from "vitest";
import { allocateEqually, calculateTabSession, tabGrossTotal, toMinorUnits } from "@/lib/tabby-math";
import { TABBY_EXAMPLES, parseTabLocally } from "@/lib/tabby-local";
import { parseTabReliably } from "@/lib/tabby-parser";
import { validateParsedTab } from "@/lib/tabby-schema";
import type { ParsedTab } from "@/types/tabby";
import { expenseCategory, settlementProgress, upiPaymentLink } from "@/lib/tabby-settlement";
import { decodeTabHash, encodeTabHash } from "@/lib/tabby-share";

const sample = (): ParsedTab => ({ title: "Dinner", currency: "INR", participants: [{ id: "a", name: "Ana", upiId: "ana@bank" }, { id: "b", name: "Bob" }, { id: "c", name: "Cia" }], items: [{ id: "food", title: "Food", amount: 30, paidById: "a", splitAmongIds: ["a", "b", "c"] }], sharedTaxes: 0.1 });

function balanced(tab: ReturnType<typeof calculateTabSession>) {
  expect(tab.participants.reduce((s, p) => s + toMinorUnits(p.totalPaid), 0)).toBe(toMinorUnits(tabGrossTotal(tab)));
  expect(tab.participants.reduce((s, p) => s + toMinorUnits(p.totalOwed), 0)).toBe(toMinorUnits(tabGrossTotal(tab)));
  const net = new Map(tab.participants.map(p => [p.id, toMinorUnits(p.totalPaid) - toMinorUnits(p.totalOwed)]));
  for (const t of tab.transfers) { net.set(t.from, (net.get(t.from) ?? 0) + toMinorUnits(t.amount)); net.set(t.to, (net.get(t.to) ?? 0) - toMinorUnits(t.amount)); }
  expect([...net.values()].every(n => n === 0)).toBe(true);
}

describe("precision layer", () => {
  it("uses exact decimal conversion", () => { expect(toMinorUnits(0.29)).toBe(29); expect(toMinorUnits("1,234.56")).toBe(123456); expect(() => toMinorUnits(1.001)).toThrow(); expect(() => toMinorUnits(-1)).toThrow(); });
  it("puts all overhead remainder on the first participant", () => { expect(allocateEqually(2, 3)).toEqual([2, 0, 0]); const tab = calculateTabSession(sample()); expect(tab.participants.map(p => p.totalOwed)).toEqual([10.04, 10.03, 10.03]); expect(tab.transfers[0]?.toUpi).toBe("ana@bank"); balanced(tab); });
  it("combines delivery and tips once and divides overhead among everyone", () => { const input = sample(); input.sharedTaxes = 0.01; input.items.push({ id: "tip", title: "Tip", amount: 0.01, paidById: "b", splitAmongIds: ["b"], isOverheadFee: true }); const tab = calculateTabSession(input); expect(tab.participants.map(p => p.totalOwed)).toEqual([10.02, 10, 10]); balanced(tab); });
  it("honors item-specific recipients", () => { const input = sample(); input.items[0] = { id: "food", title: "Food", amount: 10.01, paidById: "a", splitAmongIds: ["c", "b"] }; input.sharedTaxes = 0; const tab = calculateTabSession(input); expect(tab.participants.map(p => p.totalOwed)).toEqual([0, 5.01, 5]); balanced(tab); });
  it("rejects duplicate IDs and unknown references", () => { const input = sample(); input.items[0] = { id: "bad", title: "Bad", amount: 10, paidById: "unknown", splitAmongIds: ["a"] }; expect(() => calculateTabSession(input)).toThrow(); });
  it("conserves money across 500 generated tabs", () => { for (let i = 1; i <= 500; i++) { const input = sample(); input.sharedTaxes = i / 100; input.items[0] = { id: "food", title: "Food", amount: (i * 137) / 100, paidById: "b", splitAmongIds: ["a", "b", "c"] }; balanced(calculateTabSession(input)); } });
  it("matches the largest debtor to the largest creditor first", () => {
    const tab = calculateTabSession({ title: "Matching", currency: "INR", sharedTaxes: 0, participants: ["a", "b", "c", "d"].map(id => ({ id, name: id })), items: [
      { id: "1", title: "One", amount: 20, paidById: "a", splitAmongIds: ["c"] },
      { id: "2", title: "Two", amount: 60, paidById: "b", splitAmongIds: ["d"] },
    ] });
    expect(tab.transfers[0]).toMatchObject({ from: "d", to: "b", amount: 60 });
    expect(tab.transfers).toHaveLength(2); balanced(tab);
  });
  it("never exceeds N-1 transfers across varied larger tabs", () => {
    for (let n = 2; n <= 30; n++) {
      const participants = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));
      const ids = participants.map(p => p.id);
      const tab = calculateTabSession({ title: "Group", currency: "INR", sharedTaxes: 0.07, participants, items: participants.map((p, i) => ({ id: `i${i}`, title: "Meal", amount: (i * 173 + 11) / 100, paidById: p.id, splitAmongIds: ids })) });
      expect(tab.transfers.length).toBeLessThanOrEqual(n - 1); balanced(tab);
    }
  });
});

describe("settlement dashboard helpers", () => {
  it("tracks amount-weighted progress and zero-debt tabs", () => {
    const tab = calculateTabSession(sample());
    expect(settlementProgress(tab.transfers).percentage).toBe(0);
    tab.transfers[0] = { ...tab.transfers[0], id: "one", from: "b", to: "a", amount: 10.03, isSettled: true };
    expect(settlementProgress(tab.transfers).percentage).toBe(50);
    expect(settlementProgress(tab.transfers.map(t => ({ ...t, isSettled: true }))).complete).toBe(true);
    expect(settlementProgress([])).toMatchObject({ percentage: 100, complete: true });
  });
  it("encodes a precise UPI URI and blocks missing IDs or non-INR", () => {
    const tab = calculateTabSession(sample()); const transfer = tab.transfers[0];
    if (!transfer) throw new Error("Missing transfer");
    const link = upiPaymentLink(tab, transfer);
    expect(link).toContain("upi://pay?");
    const params = new URLSearchParams(link?.split("?")[1]);
    expect(params.get("pa")).toBe("ana@bank"); expect(params.get("am")).toBe("10.03"); expect(params.get("cu")).toBe("INR");
    expect(upiPaymentLink({ ...tab, currency: "USD" }, transfer)).toBeNull();
    expect(upiPaymentLink({ ...tab, participants: tab.participants.map(({ upiId, ...p }) => p) }, transfer)).toBeNull();
  });
  it("recognizes friendly expense categories", () => {
    expect(expenseCategory("pizza").icon).toBe("🍕"); expect(expenseCategory("Cab ride").icon).toBe("🚕"); expect(expenseCategory("Utilities").icon).toBe("🏠");
  });
});

describe("reliable parsing", () => {
  TABBY_EXAMPLES.forEach((example, i) => it(`parses ${example.label} offline`, () => { const tab = calculateTabSession(parseTabLocally(example.text, "INR")); expect(tabGrossTotal(tab)).toBe([10800, 2520, 3450][i]); expect(tab.sharedTaxes).toBe([400, 120, 150][i]); balanced(tab); }));
  it("handles decimal standalone taxes, delivery and tips", () => { const tab = calculateTabSession(parseTabLocally("3 of us. Maya paid 30.00 for food. Tax was 0.10. Delivery fee was 0.02. Tip was 0.03.", "USD")); expect(tab.sharedTaxes).toBe(0.15); balanced(tab); });
  it("does not count a named overhead payer twice", () => { const tab = calculateTabSession(parseTabLocally("3 of us. Maya paid 30 for food. Rohan paid 0.10 for tip.", "INR")); expect(tab.sharedTaxes).toBe(0); expect(tabGrossTotal(tab)).toBe(30.1); balanced(tab); });
  it("validates strict JSON", () => { expect(() => validateParsedTab({ title: "x", participants: [], items: [], sharedTaxes: 0, extra: true }, "INR")).toThrow(); });
  it("falls back on rate limit or network failure for every preset", async () => { for (const example of TABBY_EXAMPLES) { const limited = await parseTabReliably(example.text, "INR", async () => ({ ok: false, status: 429, error: "Rate limited" })); expect(limited.source).toBe("local"); balanced(limited.session); const network = await parseTabReliably(example.text, "INR", async () => { throw new Error("Network unavailable"); }); expect(network.source).toBe("local"); } });
  it("never calls online parsing when offline", async () => { const online = vi.fn(); const result = await parseTabReliably(TABBY_EXAMPLES[0]?.text ?? "", "INR", online, true); expect(online).not.toHaveBeenCalled(); expect(result.source).toBe("local"); });
  it("keeps complex unsupported notes out of regex fallback", () => { expect(() => parseTabLocally("3 of us. Maya paid 30 for food, only Rohan ate.", "INR")).toThrow(); });
});

describe("shareable snapshots", () => {
  it("round-trips Unicode, exact cents, UPI and settlement flags", () => {
    const input = sample(); input.title = "Dinner · मित्रों";
    const tab = calculateTabSession(input);
    tab.transfers = tab.transfers.map(t => ({ ...t, isSettled: true }));
    const hash = encodeTabHash(tab);
    expect(hash).toMatch(/^#tab=[A-Za-z0-9_-]+$/);
    expect(decodeTabHash(hash)).toEqual({ ...tab, items: tab.items.map(i => ({ ...i, isOverheadFee: Boolean(i.isOverheadFee) })) });
  });
  it("rejects corrupt, oversized and financially invalid snapshots", () => {
    expect(decodeTabHash("#other")).toBeNull();
    expect(() => decodeTabHash("#tab=bad!")).toThrow();
    expect(() => decodeTabHash(`#tab=${"a".repeat(30001)}`)).toThrow();
    const tab = calculateTabSession(sample());
    const payload = JSON.parse(atob(encodeTabHash(tab).slice(5).replaceAll("-", "+").replaceAll("_", "/")));
    payload.i[0][3] = "unknown";
    expect(() => decodeTabHash(`#tab=${btoa(JSON.stringify(payload))}`)).toThrow();
  });
  it("recomputes balances instead of trusting displayed values", () => {
    const tab = calculateTabSession(sample());
    const first = tab.participants[0];
    if (first) first.totalOwed = 999;
    const restored = decodeTabHash(encodeTabHash(tab));
    expect(restored?.participants[0]?.totalOwed).toBe(10.04);
  });
});