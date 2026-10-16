import { z } from "zod";
import type { ParsedTab } from "@/types/tabby";

// All wire fields are required; nullable values represent optional contract fields.
export const parsedTabSchema = z.object({
  title: z.string(),
  participants: z.array(z.object({ id: z.string(), name: z.string(), upiId: z.string().nullable() }).strict()),
  items: z.array(z.object({ id: z.string(), title: z.string(), amount: z.number(), paidById: z.string(), splitAmongIds: z.array(z.string()), isOverheadFee: z.boolean() }).strict()),
  sharedTaxes: z.number(),
}).strict();

export function validateParsedTab(input: unknown, currency: string): ParsedTab {
  if (!["INR", "USD", "EUR"].includes(currency)) throw new Error("Unsupported currency.");
  const parsed = parsedTabSchema.parse(input);
  if (!parsed.title.trim() || parsed.title.length > 200 || parsed.participants.some(p => !p.name.trim() || p.name.length > 100) || parsed.items.some(i => !i.title.trim() || i.title.length > 200)) throw new Error("The parsed tab contains invalid names or titles.");
  return { ...parsed, currency, participants: parsed.participants.map(({ upiId, ...p }) => ({ ...p, ...(upiId ? { upiId } : {}) })) };
}