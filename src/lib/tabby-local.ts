import type { ParsedTab } from "@/types/tabby";
import { fromMinorUnits, toMinorUnits } from "./tabby-math";
import { parseAsymmetric } from "./tabby-flex";

export const TABBY_EXAMPLES = [
  { label: "Road trip cabin", text: "4 of us went on a road trip. Maya paid 8000 for the cabin, Rohan paid 2400 for fuel. Tax was 400. Split equally." },
  { label: "Weekend dinner & cabs", text: "4 of us grabbed pizza and cabs. Maya paid 1800 for food, Rohan paid 600 for cab. Tax was 120. Split equally." },
  { label: "Monthly flat utilities", text: "3 of us share a flat. Maya paid 2400 for electricity, Rohan paid 900 for internet. Tax was 150. Split equally." },
];

export function parseTabLocally(notes: string, currency: string): ParsedTab {
  if (!["INR", "USD", "EUR"].includes(currency)) throw new Error("Unsupported currency.");
  if (/\b(?:only|excluding|except|unequally|percent|included|including|refund)\b|%/i.test(notes)) throw new Error("These notes need online parsing. For an offline split, use an equal-split example.");
  const count = Number(notes.match(/\b(\d+)\s+(?:of us|people|friends|roommates)\b/i)?.[1]);
  if (!Number.isInteger(count) || count < 2 || count > 30) throw new Error("Include a group size, such as ‘4 of us’, or choose an example.");
  const paymentPattern = /\b([A-Za-z][A-Za-z'-]*)\s+paid\s*[₹$€]?\s*(\d[\d,]*(?:\.\d{1,2})?)(?![\d.])\s+for\s+(?:the\s+)?([^,.\n]+)(?:[,.]|$)/gi;
  const payments = [...notes.matchAll(paymentPattern)].flatMap(m => {
    const name = m[1], amount = m[2], title = m[3]?.trim();
    return name && amount && title ? [{ name, amount: fromMinorUnits(toMinorUnits(amount)), title }] : [];
  });
  const paidMentions = [...notes.matchAll(/\bpaid\b/gi)].length;
  if (!payments.length || payments.length !== paidMentions) throw new Error("Include each payment as ‘Maya paid 1800 for food’, or choose an example.");
  const names = [...new Map(payments.map(p => [p.name.toLowerCase(), p.name])).values()];
  if (names.length > count) throw new Error("There are more payers than participants.");
  const participants = Array.from({ length: count }, (_, i) => ({ id: `person-${i + 1}`, name: names[i] ?? `Friend ${i - names.length + 1}` }));
  const ids = participants.map(p => p.id);
  const items = payments.map((p, i) => {
    const payer = participants.find(person => person.name.toLowerCase() === p.name.toLowerCase());
    if (!payer) throw new Error("Unknown payer.");
    return { id: `item-${i + 1}`, title: p.title, amount: p.amount, paidById: payer.id, splitAmongIds: [...ids], isOverheadFee: /\b(?:tax|taxes|delivery|fee|fees|tip|tips)\b/i.test(p.title) };
  });
  // Use full text for decimals (periods inside monetary literals must not split clauses).
  const standalone = /(?:^|[.\n])\s*(tax(?:es)?|delivery(?:\s+fees?)?|fees?|tips?)\s*(?:was|were|is|of|:)?\s*[₹$€]?\s*(\d[\d,]*(?:\.\d{1,2})?)(?!\d|\.\d)/gi;
  const taxMinor = [...notes.matchAll(standalone)].reduce((sum, m) => sum + (m[2] ? toMinorUnits(m[2]) : 0), 0);
  const title = /cabin|road trip/i.test(notes) ? "Road trip cabin" : /electricity|internet|flat/i.test(notes) ? "Monthly flat utilities" : /pizza|dinner|cab/i.test(notes) ? "Weekend dinner & cabs" : "Shared tab";
  return { title, currency, participants, items, sharedTaxes: fromMinorUnits(taxMinor) };
}