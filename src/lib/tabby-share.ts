// ============= Full file contents =============

import { z } from "zod";
import { calculateTabSession, fromMinorUnits, toMinorUnits } from "@/lib/tabby-math";
import type { TabSession } from "@/types/tabby";

const MAX_ENCODED = 30000;

const titleField = z.string().trim().min(1).max(200);
const amountField = z.number().int().nonnegative().max(1e12);
const indexField = z.number().int().nonnegative();

// Version 1: explicit participant/item ids in every entry.
const payloadV1Schema = z.object({
  v: z.literal(1), t: z.string().trim().min(1).max(200), c: z.enum(["INR", "USD", "EUR"]),
  p: z.array(z.tuple([z.string().min(1).max(100), z.string().trim().min(1).max(100), z.string().max(100).nullable()])).min(2).max(30),
  i: z.array(z.tuple([z.string().min(1).max(100), titleField, amountField, z.string().max(100), z.array(z.string().max(100)).min(1).max(30), z.boolean()])).min(1).max(100),
  tax: amountField, s: z.array(z.tuple([z.string(), z.string(), amountField])).max(29),
}).strict();

// Version 2: participants and items referenced by index, defaults omitted.
const itemV2Field: z.ZodType<[string, number, number, number[], boolean?]> = z.union([
  z.tuple([titleField, amountField, indexField, z.array(indexField).min(1).max(30)]),
  z.tuple([titleField, amountField, indexField, z.array(indexField).min(1).max(30), z.boolean()]),
]);
const payloadV2Schema = z.object({
  v: z.literal(2), t: z.string().trim().min(1).max(200), c: z.enum(["INR", "USD", "EUR"]),
  p: z.array(z.string().trim().min(1).max(100)).min(2).max(30),
  u: z.array(z.string().max(100)).max(30).optional(),
  i: z.array(itemV2Field).min(1).max(100),
  tax: amountField.optional(),
  s: z.array(z.tuple([indexField, indexField, amountField])).max(29).optional(),
}).strict();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, n => String.fromCharCode(n)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}

export function encodeTabHash(tab: TabSession): string {
  const indexOf = (id: string) => {
    const index = tab.participants.findIndex(p => p.id === id);
    if (index < 0) throw new Error("Unknown participant in this tab.");
    return index;
  };
  const payload: Record<string, unknown> = {
    v: 2, t: tab.title, c: tab.currency,
    p: tab.participants.map(p => p.name),
    i: tab.items.map(item => {
      const base = [item.title, toMinorUnits(item.amount), indexOf(item.paidById), item.splitAmongIds.map(indexOf)];
      return item.isOverheadFee ? [...base, true] : base;
    }),
  };
  if (tab.participants.some(p => p.upiId)) payload["u"] = tab.participants.map(p => p.upiId ?? "");
  const taxMinor = toMinorUnits(tab.sharedTaxes);
  if (taxMinor) payload["tax"] = taxMinor;
  const settled = tab.transfers.filter(t => t.isSettled).map(t => [indexOf(t.from), indexOf(t.to), toMinorUnits(t.amount)]);
  if (settled.length) payload["s"] = settled;
  payloadV2Schema.parse(payload);
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  if (encoded.length > MAX_ENCODED) throw new Error("This tab is too large for a share link. Reduce the number of items.");
  return `#tab=${encoded}`;
}

export function decodeTabHash(hash: string): TabSession | null {
  if (!hash.startsWith("#tab=")) return null;
  const encoded = hash.slice(5);
  if (!encoded || encoded.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("This tab link is invalid or too large.");
  try {
    const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(encoded)));
    const isV2 = typeof raw === "object" && raw !== null && (raw as { v?: unknown }).v === 2;
    return isV2 ? decodeV2(raw) : decodeV1(raw);
  } catch { throw new Error("This tab link couldn’t be read. Ask your friend for a fresh link."); }
}

function resolveSettled(tab: TabSession, pairs: { from: string; to: string; amountMinor: number }[]): TabSession {
  if (pairs.some(x => !tab.transfers.some(t => t.from === x.from && t.to === x.to && toMinorUnits(t.amount) === x.amountMinor))) throw new Error("Invalid settlement");
  return { ...tab, transfers: tab.transfers.map(t => ({ ...t, isSettled: pairs.some(x => t.from === x.from && t.to === x.to && toMinorUnits(t.amount) === x.amountMinor) })) };
}

function decodeV1(raw: unknown): TabSession {
  const p = payloadV1Schema.parse(raw);
  const tab = calculateTabSession({ title: p.t, currency: p.c, sharedTaxes: fromMinorUnits(p.tax), participants: p.p.map(([id, name, upiId]) => ({ id, name, ...(upiId ? { upiId } : {}) })), items: p.i.map(([id, title, amount, paidById, splitAmongIds, isOverheadFee]) => ({ id, title, amount: fromMinorUnits(amount), paidById, splitAmongIds, isOverheadFee })) });
  return resolveSettled(tab, p.s.map(([from, to, amount]) => ({ from, to, amountMinor: amount })));
}

function decodeV2(raw: unknown): TabSession {
  const p = payloadV2Schema.parse(raw);
  const ids = p.p.map((_, i) => `person-${i + 1}`);
  const participant = (index: number): string => {
    const id = ids[index];
    if (index < 0 || !id) throw new Error("Invalid participant reference.");
    return id;
  };
  const tab = calculateTabSession({
    title: p.t, currency: p.c, sharedTaxes: fromMinorUnits(p.tax ?? 0),
    participants: p.p.map((name, i) => ({ id: ids[i], name, ...(p.u?.[i] ? { upiId: p.u[i] } : {}) })),
    items: p.i.map(([title, amount, payer, split, overhead], i) => ({ id: `item-${i + 1}`, title, amount: fromMinorUnits(amount), paidById: participant(payer), splitAmongIds: split.map(participant), ...(overhead ? { isOverheadFee: true } : {}) })),
  });
  return resolveSettled(tab, (p.s ?? []).map(([from, to, amount]) => ({ from: participant(from), to: participant(to), amountMinor: amount })));
}
