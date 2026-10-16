import { describe, expect, it } from "vitest";
import { parseTabLocally } from "@/lib/tabby-local";
import { calculateTabSession } from "@/lib/tabby-math";
const NOTES = "Friday dinner total was 4800 paid by Maya. Rohan, Arjun, Maya, and Sneha were there. Sneha didn't drink so her share is only 600 for food. Split the rest equally among Maya, Rohan, and Arjun. 200 service charge split equally across all 4.";
describe("asymmetric notes", () => {
  it("parses Test Suite 2", () => {
    const s = calculateTabSession(parseTabLocally(NOTES, "INR"));
    const by = (n: string) => s.participants.find(p => p.name === n)!;
    expect(by("Maya").totalPaid).toBe(5000);
    expect(by("Maya").netBalance).toBe(3550);
    expect(by("Sneha").totalOwed).toBe(650);
    expect(by("Rohan").totalOwed).toBe(1450);
    expect(by("Arjun").totalOwed).toBe(1450);
    expect(s.participants).toHaveLength(4);
    expect(s.transfers.every(t => t.to === by("Maya").id)).toBe(true);
  });
});
