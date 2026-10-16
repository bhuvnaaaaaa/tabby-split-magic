import { z } from "zod";
import { calculateTabSession, fromMinorUnits, toMinorUnits } from "@/lib/tabby-math";
import type { TabSession } from "@/types/tabby";

const payloadSchema = z.object({
  v: z.literal(1), t: z.string().trim().min(1).max(200), c: z.enum(["INR", "USD", "EUR"]),
  p: z.array(z.tuple([z.string().min(1).max(100), z.string().trim().min(1).max(100), z.string().max(100).nullable()])).min(2).max(30),
  i: z.array(z.tuple([z.string().min(1).max(100), z.string().trim().min(1).max(200), z.number().int().nonnegative().max(1e12), z.string().max(100), z.array(z.string().max(100)).min(1).max(30), z.boolean()])).min(1).max(100),
  tax: z.number().int().nonnegative().max(1e12), s: z.array(z.tuple([z.string(), z.string(), z.number().int().nonnegative()])).max(29),
}).strict();

export function encodeTabHash(tab: TabSession): string {
  const payload = { v: 1, t: tab.title, c: tab.currency, p: tab.participants.map(p => [p.id, p.name, p.upiId ?? null]), i: tab.items.map(i => [i.id, i.title, toMinorUnits(i.amount), i.paidById, i.splitAmongIds, Boolean(i.isOverheadFee)]), tax: toMinorUnits(tab.sharedTaxes), s: tab.transfers.filter(t => t.isSettled).map(t => [t.from, t.to, toMinorUnits(t.amount)]) };
  payloadSchema.parse(payload);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(Array.from(bytes, n => String.fromCharCode(n)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (encoded.length > 30000) throw new Error("This tab is too large for a share link. Reduce the number of items.");
  return `#tab=${encoded}`;
}

export function decodeTabHash(hash: string): TabSession | null {
  if (!hash.startsWith("#tab=")) return null;
  const encoded = hash.slice(5);
  if (!encoded || encoded.length > 30000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("This tab link is invalid or too large.");
  try {
    const bytes = Uint8Array.from(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
    const p = payloadSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    const tab = calculateTabSession({ title: p.t, currency: p.c, sharedTaxes: fromMinorUnits(p.tax), participants: p.p.map(([id, name, upiId]) => ({ id, name, ...(upiId ? { upiId } : {}) })), items: p.i.map(([id, title, amount, paidById, splitAmongIds, isOverheadFee]) => ({ id, title, amount: fromMinorUnits(amount), paidById, splitAmongIds, isOverheadFee })) });
    if (p.s.some(([from, to, amount]) => !tab.transfers.some(t => t.from === from && t.to === to && toMinorUnits(t.amount) === amount))) throw new Error("Invalid settlement");
    return { ...tab, transfers: tab.transfers.map(t => ({ ...t, isSettled: p.s.some(([from, to, amount]) => t.from === from && t.to === to && toMinorUnits(t.amount) === amount) })) };
  } catch { throw new Error("This tab link couldn’t be read. Ask your friend for a fresh link."); }
}