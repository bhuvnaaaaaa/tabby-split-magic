import { toMinorUnits } from "@/lib/tabby-math";
import type { TabSession, TransferAction } from "@/types/tabby";

export function settlementProgress(transfers: TransferAction[]) {
  const total = transfers.reduce((sum, t) => sum + toMinorUnits(t.amount), 0);
  const settled = transfers.filter(t => t.isSettled).reduce((sum, t) => sum + toMinorUnits(t.amount), 0);
  const complete = transfers.every(t => t.isSettled);
  return { total, settled, percentage: complete ? 100 : Math.min(99, Math.round(settled / total * 100)), complete };
}

const UPI_BANKS = ["okaxis", "okhdfcbank", "okicici", "upi"];
/** Suggested demo handle for a friend without a real UPI ID, e.g. maya@okaxis. */
export function defaultUpiHandle(name: string) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, "") || "friend";
  const bank = UPI_BANKS[[...handle].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % UPI_BANKS.length];
  return `${handle}@${bank}`;
}

export function upiPaymentLink(tab: TabSession, transfer: TransferAction): string | null {
  const recipient = tab.participants.find(p => p.id === transfer.to);
  const upi = recipient?.upiId?.trim() || (recipient ? defaultUpiHandle(recipient.name) : "");
  if (tab.currency !== "INR" || !recipient || !upi || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upi)) return null;
  const q = [`pa=${encodeURIComponent(upi)}`, `pn=${encodeURIComponent(recipient.name)}`, `am=${(toMinorUnits(transfer.amount) / 100).toFixed(2)}`, "cu=INR", `tn=${encodeURIComponent(`Tabby: ${tab.title}`.slice(0, 80))}`];
  return `upi://pay?${q.join("&")}`;
}

export function expenseCategory(title: string) {
  if (/pizza|food|dinner|lunch|breakfast|coffee|restaurant|meal|dining/i.test(title)) return { icon: "🍕", label: "Dining" };
  if (/cab|taxi|transport|fuel|petrol|train|bus|ride/i.test(title)) return { icon: "🚕", label: "Transport" };
  if (/rent|utilit|electric|internet|water|flat|cabin|stay|hotel/i.test(title)) return { icon: "🏠", label: "Home & stays" };
  return { icon: "", label: /tax|tip|delivery|fee/i.test(title) ? "Shared fee" : "Shared expense" };
}
/** Playful badge for a payout, from the creditor's largest category of paid items. */
export function payoutTag(tab: TabSession, transfer: TransferAction) {
  const totals = new Map<string, number>();
  for (const item of tab.items) {
    if (item.paidById !== transfer.to || item.isOverheadFee) continue;
    const label = expenseCategory(item.title).label;
    totals.set(label, (totals.get(label) ?? 0) + toMinorUnits(item.amount));
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === "Dining") return { icon: "🍕", label: "Food Feast" };
  if (top === "Transport") return { icon: "🚕", label: "Cab Split" };
  if (top === "Home & stays") return { icon: "🏠", label: "Flat Utilities" };
  return { icon: "🧾", label: "Shared Tab" };
}
