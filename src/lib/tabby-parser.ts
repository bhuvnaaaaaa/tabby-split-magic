import type { TabSession } from "@/types/tabby";
import { calculateTabSession } from "./tabby-math";
import { parseTabLocally } from "./tabby-local";
import { FLEX_NOTICE, parseLeniently } from "./tabby-flex";

export type OnlineParseResult = { ok: true; session: TabSession } | { ok: false; status: number; error: string };
export type ParseResult = { session: TabSession; source: "online" | "local"; warning?: string };

export async function parseTabReliably(notes: string, currency: string, online: () => Promise<OnlineParseResult>, isOffline = false): Promise<ParseResult> {
  // Fast path: notes the on-device reader understands are split instantly, no network round-trip.
  try { return { session: calculateTabSession(parseTabLocally(notes, currency)), source: "local" }; } catch { /* fall through to online reading */ }
  let warning = isOffline ? "You’re offline. This tab was split on your device." : "";
  if (!isOffline) {
    try {
      const response = await online();
      if (response.ok) return { session: response.session, source: "online" };
      warning = response.error;
    } catch (error) {
      warning = error instanceof Error ? error.message : "Online parsing is unavailable. This tab was split on your device.";
    }
  }
  try { return { session: calculateTabSession(parseTabLocally(notes, currency)), source: "local", ...(isOffline ? { warning } : {}) }; }
  catch (error) {
    try { const lenient = parseLeniently(notes, currency); if (lenient) return { session: calculateTabSession(lenient), source: "local", warning: FLEX_NOTICE }; } catch { /* nothing usable */ }
    throw new Error(`${warning} ${error instanceof Error ? error.message : "Choose an example to split offline."}`.trim());
  }
}