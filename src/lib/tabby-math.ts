import type { ParsedTab, TabSession, TransferAction } from "@/types/tabby";

const MAX_MINOR = 1_000_000_000_000;

/** Monetary inputs must have at most two decimal places. Never round away money. */
export function toMinorUnits(value: number | string): number {
  const text = String(value).replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Amounts must be non-negative with at most two decimal places.");
  const [whole = "0", fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) throw new Error("This amount is too large to split safely.");
  return minor;
}

export function fromMinorUnits(minor: number): number {
  if (!Number.isSafeInteger(minor)) throw new Error("Invalid minor-unit amount.");
  return minor / 100;
}

/** All odd pennies/paise belong to the first recipient, not one penny each. */
export function allocateEqually(minor: number, count: number): number[] {
  if (!Number.isSafeInteger(minor) || minor < 0 || !Number.isInteger(count) || count < 1) throw new Error("Invalid equal split.");
  const base = Math.floor(minor / count);
  const remainder = minor - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? remainder : 0));
}

export function calculateTabSession(tab: ParsedTab): TabSession {
  if (tab.participants.length < 2 || tab.participants.length > 30) throw new Error("A tab needs between 2 and 30 participants.");
  if (!tab.items.length || tab.items.length > 100) throw new Error("Add between 1 and 100 expense items.");
  const ids = tab.participants.map(p => p.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !id.trim())) throw new Error("Participant IDs must be unique and non-empty.");
  if (new Set(tab.items.map(i => i.id)).size !== tab.items.length) throw new Error("Expense IDs must be unique.");
  const first = tab.participants[0];
  if (!first) throw new Error("No participants found.");
  const paid = new Map(ids.map(id => [id, 0]));
  const owed = new Map(ids.map(id => [id, 0]));
  let overhead = toMinorUnits(tab.sharedTaxes);
  let gross = overhead;
  // Tax without a named payer is credited to the first participant, explicitly in UI.
  paid.set(first.id, overhead);
  for (const item of tab.items) {
    const amount = toMinorUnits(item.amount);
    if (!paid.has(item.paidById)) throw new Error("An expense refers to an unknown payer.");
    if (!item.splitAmongIds.length || new Set(item.splitAmongIds).size !== item.splitAmongIds.length || item.splitAmongIds.some(id => !owed.has(id))) throw new Error("Each expense needs a valid, unique set of participants.");
    gross += amount;
    if (!Number.isSafeInteger(gross) || gross > MAX_MINOR) throw new Error("The tab total is too large to split safely.");
    paid.set(item.paidById, (paid.get(item.paidById) ?? 0) + amount);
    if (item.isOverheadFee) { overhead += amount; continue; }
    const ordered = ids.filter(id => item.splitAmongIds.includes(id));
    const shares = allocateEqually(amount, ordered.length);
    ordered.forEach((id, i) => owed.set(id, (owed.get(id) ?? 0) + (shares[i] ?? 0)));
  }
  const overheadShares = allocateEqually(overhead, ids.length);
  ids.forEach((id, i) => owed.set(id, (owed.get(id) ?? 0) + (overheadShares[i] ?? 0)));
  const participants = tab.participants.map(p => {
    const totalPaid = paid.get(p.id) ?? 0;
    const totalOwed = owed.get(p.id) ?? 0;
    return { ...p, totalPaid: fromMinorUnits(totalPaid), totalOwed: fromMinorUnits(totalOwed), netBalance: fromMinorUnits(totalPaid - totalOwed) };
  });
  const balances = ids.map(id => ({ id, balance: (paid.get(id) ?? 0) - (owed.get(id) ?? 0) }));
  if ([...paid.values()].reduce((s, n) => s + n, 0) !== gross || [...owed.values()].reduce((s, n) => s + n, 0) !== gross || balances.reduce((s, p) => s + p.balance, 0) !== 0) throw new Error("The tab totals do not balance.");
  const creditors = balances.filter(p => p.balance > 0);
  const debtors = balances.filter(p => p.balance < 0);
  const transfers: TransferAction[] = [];
  while (debtors.some(p => p.balance < 0) && creditors.some(p => p.balance > 0)) {
    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);
    const debtor = debtors[0];
    const creditor = creditors[0];
    if (!debtor || !creditor) break;
    const amount = Math.min(-debtor.balance, creditor.balance);
    if (amount <= 0) break;
    const upi = participants.find(p => p.id === creditor.id)?.upiId;
    transfers.push({ id: `transfer-${transfers.length + 1}`, from: debtor.id, to: creditor.id, ...(upi ? { toUpi: upi } : {}), amount: fromMinorUnits(amount), isSettled: false });
    debtor.balance += amount;
    creditor.balance -= amount;
  }
  if (balances.some(p => p.balance !== 0)) throw new Error("Transfers could not settle this tab.");
  return { ...tab, participants, transfers };
}

export function tabGrossTotal(tab: Pick<TabSession, "items" | "sharedTaxes">): number {
  return fromMinorUnits(tab.items.reduce((s, item) => s + toMinorUnits(item.amount), toMinorUnits(tab.sharedTaxes)));
}

export function tabOverheadTotal(tab: Pick<TabSession, "items" | "sharedTaxes">): number {
  return fromMinorUnits(tab.items.filter(i => i.isOverheadFee).reduce((s, item) => s + toMinorUnits(item.amount), toMinorUnits(tab.sharedTaxes)));
}