import type { ParsedTab } from "@/types/tabby";
import { fromMinorUnits, toMinorUnits } from "./tabby-math";

const AMT = String.raw`[₹$€]?\s*(\d[\d,]*(?:\.\d{1,2})?)(?![\d])`;
const NAME = String.raw`[A-Z][A-Za-z'-]+`;
const STOP = new Set(["Friday", "Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday", "Split", "Tax", "Taxes", "Gst", "GST", "Total", "The", "We", "Our", "Dinner", "Lunch", "Breakfast", "Service", "Then", "And", "But", "So", "She", "He", "They", "Her", "His", "Rest", "Everyone", "All", "Tip", "Food", "Drinks", "Bill", "Cab", "Cabs", "Last", "This", "That", "Today", "Yesterday", "Tonight", "Weekend", "Paid", "It", "I", "Me", "INR", "USD", "EUR"]);

export const FLEX_NOTICE = "We untangled the main amounts—tap '+ Edit' if you want to tweak any individual shares.";

function namesIn(text: string): string[] {
  const seen = new Map<string, string>();
  for (const m of text.matchAll(new RegExp(String.raw`\b(${NAME})\b`, "g"))) {
    const n = m[1]!;
    if (STOP.has(n) || n.length < 2) continue;
    if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  }
  return [...seen.values()];
}

function feesIn(notes: string): number {
  const fee = String.raw`(?:service\s+charges?|gst|tax(?:es)?|tips?|delivery(?:\s+fees?)?)`;
  let minor = 0;
  const used = new Set<number>();
  for (const m of notes.matchAll(new RegExp(String.raw`${AMT}\s*(?:in\s+|for\s+|of\s+)?${fee}`, "gi"))) { minor += toMinorUnits(m[1]!); used.add(m.index!); }
  for (const m of notes.matchAll(new RegExp(String.raw`${fee}\s*(?:was|were|is|of|:)?\s*${AMT}`, "gi"))) { if (![...used].some(i => Math.abs(i - m.index!) < 40)) minor += toMinorUnits(m[1]!); }
  return minor;
}

/** Handles "total X paid by A … B's share is only Y … split the rest among …". */
export function parseAsymmetric(notes: string, currency: string): ParsedTab | null {
  const total = notes.match(new RegExp(String.raw`(?:total|bill)\s+(?:was|is|of|came to|:)?\s*${AMT}\s*,?\s*(?:and\s+)?(?:was\s+)?paid\s+by\s+(${NAME})`, "i"))
    ?? (() => { const m = notes.match(new RegExp(String.raw`(${NAME})\s+paid\s+(?:the\s+)?(?:total\s+(?:of\s+)?)?${AMT}`)); return m ? [m[0], m[2], m[1]] as unknown as RegExpMatchArray : null; })();
  if (!total) return null;
  const totalMinor = toMinorUnits(total[1]!);
  const payer = total[2]!;
  const fixed = [...notes.matchAll(new RegExp(String.raw`\b(${NAME})\b[^.\n]*?\bonly\s+(?:had|owes|pays|ate|is)?\s*${AMT}`, "g"))].filter(m => !STOP.has(m[1]!));
  if (!fixed.length) return null;
  const all = namesIn(notes);
  const ordered = [payer, ...all.filter(n => n.toLowerCase() !== payer.toLowerCase())];
  if (ordered.length < 2 || ordered.length > 30) return null;
  const participants = ordered.map((name, i) => ({ id: `person-${i + 1}`, name }));
  const idOf = (n: string) => participants.find(p => p.name.toLowerCase() === n.toLowerCase())?.id;
  const items: ParsedTab["items"] = [];
  let fixedMinor = 0;
  const fixedIds = new Set<string>();
  for (const m of fixed) {
    const id = idOf(m[1]!); if (!id || fixedIds.has(id)) continue;
    const amt = toMinorUnits(m[2]!); fixedMinor += amt; fixedIds.add(id);
    items.push({ id: `item-${items.length + 1}`, title: `${m[1]}'s share`, amount: fromMinorUnits(amt), paidById: participants[0]!.id, splitAmongIds: [id], isOverheadFee: false });
  }
  if (fixedMinor > totalMinor) return null;
  const restClause = notes.match(/rest[^.\n]*?\bamong\s+([^.\n]+)/i)?.[1];
  let restIds = restClause ? namesIn(restClause).map(idOf).filter((x): x is string => !!x) : [];
  if (!restIds.length) restIds = participants.map(p => p.id).filter(id => !fixedIds.has(id));
  const rest = totalMinor - fixedMinor;
  if (rest > 0) {
    if (!restIds.length) return null;
    items.push({ id: `item-${items.length + 1}`, title: "Everything else", amount: fromMinorUnits(rest), paidById: participants[0]!.id, splitAmongIds: participants.map(p => p.id).filter(id => restIds.includes(id)), isOverheadFee: false });
  }
  const title = /dinner/i.test(notes) ? "Dinner" : /lunch/i.test(notes) ? "Lunch" : /trip/i.test(notes) ? "Trip" : "Shared tab";
  return { title: /friday/i.test(notes) ? `Friday ${title.toLowerCase()}` : title, currency, participants, items, sharedTaxes: fromMinorUnits(feesIn(notes)) };
}

/** Last-resort best effort: named payments split equally among every detected name. */
export function parseLeniently(notes: string, currency: string): ParsedTab | null {
  const pays = [
    ...[...notes.matchAll(new RegExp(String.raw`\b(${NAME})\s+paid\s+(?:for\s+[^0-9₹$€.\n]*?)?${AMT}`, "g"))].map(m => ({ name: m[1]!, amt: m[2]!, at: m.index! })),
    ...[...notes.matchAll(new RegExp(String.raw`${AMT}[^.\n]{0,30}?paid\s+by\s+(${NAME})`, "gi"))].map(m => ({ name: m[2]!, amt: m[1]!, at: m.index! })),
  ].filter(p => !STOP.has(p.name)).sort((a, b) => a.at - b.at);
  if (!pays.length) return null;
  const names = namesIn(notes);
  const count = Number(notes.match(/\b(\d+)\s+(?:of us|people|friends|roommates)\b/i)?.[1]) || 0;
  const total = Math.min(30, Math.max(names.length, count, 2));
  const ordered = [...new Map([...pays.map(p => p.name), ...names].map(n => [n.toLowerCase(), n])).values()].slice(0, total);
  const participants = Array.from({ length: total }, (_, i) => ({ id: `person-${i + 1}`, name: ordered[i] ?? `Friend ${i - ordered.length + 1}` }));
  const ids = participants.map(p => p.id);
  const items = pays.map((p, i) => ({ id: `item-${i + 1}`, title: `Paid by ${p.name}`, amount: fromMinorUnits(toMinorUnits(p.amt)), paidById: participants.find(x => x.name.toLowerCase() === p.name.toLowerCase())!.id, splitAmongIds: [...ids], isOverheadFee: false }));
  return { title: "Shared tab", currency, participants, items, sharedTaxes: fromMinorUnits(feesIn(notes)) };
}
