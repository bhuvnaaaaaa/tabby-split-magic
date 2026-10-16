import type { TabSession } from "@/types/tabby";
import { calculateTabSession } from "./tabby-math";

/**
 * Pre-tested sample cafe receipt, ready to load straight into the review step
 * so judges can try bill scanning with one click, no photo upload needed.
 */
export function buildSampleReceipt(currency: string): TabSession {
  return calculateTabSession({
    title: "THE CORNER CAFE",
    currency,
    participants: [
      { id: "person-1", name: "Payer" },
      { id: "person-2", name: "Friend 1" },
      { id: "person-3", name: "Friend 2" },
      { id: "person-4", name: "Friend 3" },
    ],
    items: [
      { id: "item-1", title: "Cappuccino ×2", amount: 360, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"] },
      { id: "item-2", title: "Butter Croissant ×2", amount: 340, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"] },
      { id: "item-3", title: "Avocado Toast", amount: 420, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"] },
      { id: "item-4", title: "Blueberry Muffin", amount: 220, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"] },
      { id: "item-5", title: "Cold Coffee", amount: 280, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"] },
      { id: "item-6", title: "Service charge (5%)", amount: 81, paidById: "person-1", splitAmongIds: ["person-1", "person-2", "person-3", "person-4"], isOverheadFee: true },
    ],
    sharedTaxes: 0,
  });
}
