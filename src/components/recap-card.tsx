import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tabGrossTotal, tabOverheadTotal } from "@/lib/tabby-math";
import type { TabSession } from "@/types/tabby";

function receiptDate() {
  return new Date().toLocaleDateString("en", { month: "short", day: "numeric" }).toUpperCase();
}

export function RecapCard({ session }: { session: TabSession }) {
  const [status, setStatus] = useState("");
  const money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: session.currency, maximumFractionDigits: 2 }).format(n);
  const total = tabGrossTotal(session);
  const taxes = tabOverheadTotal(session);
  const allSettled = session.transfers.length > 0 && session.transfers.every(t => t.isSettled);
  const stamp = allSettled ? "PAID IN FULL ✓" : "THANK YOU FOR SETTLING FAIRLY";

  function chatText() {
    const line = "--------------------------------";
    const rows = session.participants.map(p => {
      const due = money(p.totalOwed);
      const dots = ".".repeat(Math.max(2, 30 - p.name.length - due.length));
      return `${p.name} ${dots} ${due}`;
    });
    return [
      "*** TABBY BILLING & SETTLEMENT ***",
      session.title.toUpperCase(),
      `DATE: ${receiptDate()} • GUEST COUNT: ${session.participants.length}`,
      line,
      ...rows,
      `Shared tax & fees (split evenly) .. ${money(taxes)}`,
      line,
      `TOTAL TAB: ${money(total)}`,
      stamp,
      "— sent from Tabby",
    ].join("\n");
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(chatText());
      setStatus("Copied to clipboard!");
    } catch { setStatus("Couldn't copy on this device — try selecting the text instead."); }
  }

  async function download() {
    try {
      await document.fonts?.ready;
      const W = 1080, H = 1920, c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error();
      const css = getComputedStyle(document.querySelector(".tabby-app") ?? document.documentElement);
      const v = (name: string) => css.getPropertyValue(name).trim();
      const paper = "#FAF9F5", ink = "#3b2f3f", faint = "#8a7a90";
      ctx.fillStyle = v("--secondary"); ctx.fillRect(0, 0, W, H);
      const x = 130, w = W - 260, top = 200, bottom = H - 260;
      ctx.fillStyle = paper; ctx.fillRect(x, top, w, bottom - top);
      // serrated bottom edge
      ctx.beginPath();
      for (let px = x; px < x + w; px += 24) { ctx.moveTo(px, bottom); ctx.lineTo(px + 12, bottom + 18); ctx.lineTo(px + 24, bottom); }
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = faint; ctx.font = "600 26px monospace"; ctx.fillText("*** TABBY BILLING & SETTLEMENT ***", W / 2, top + 90);
      ctx.fillStyle = ink; ctx.font = "700 52px monospace";
      const title = session.title.toUpperCase();
      ctx.fillText(title.length > 26 ? `${title.slice(0, 25)}…` : title, W / 2, top + 160);
      ctx.fillStyle = faint; ctx.font = "500 24px monospace";
      ctx.fillText(`DATE: ${receiptDate()}  •  GUEST COUNT: ${session.participants.length}  •  STATUS: ACTIVE`, W / 2, top + 210);
      const dash = (y: number) => { ctx.strokeStyle = faint; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(x + 50, y); ctx.lineTo(x + w - 50, y); ctx.stroke(); ctx.setLineDash([]); };
      dash(top + 250);
      let y = top + 320;
      ctx.font = "600 32px monospace";
      for (const p of session.participants.slice(0, 12)) {
        ctx.textAlign = "left"; ctx.fillStyle = ink; ctx.fillText(p.name, x + 60, y);
        ctx.textAlign = "right"; ctx.fillText(money(p.totalOwed), x + w - 60, y);
        y += 64;
      }
      ctx.textAlign = "left"; ctx.fillStyle = faint; ctx.font = "500 26px monospace"; ctx.fillText("Shared tax & fees (split evenly)", x + 60, y);
      ctx.textAlign = "right"; ctx.fillText(money(taxes), x + w - 60, y);
      y += 50; dash(y);
      y += 80; ctx.textAlign = "center"; ctx.fillStyle = ink; ctx.font = "700 44px monospace"; ctx.fillText(`TOTAL TAB: ${money(total)}`, W / 2, y);
      y += 110;
      ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.04);
      ctx.strokeStyle = allSettled ? v("--success") : v("--primary"); ctx.lineWidth = 4;
      ctx.strokeRect(-330, -46, 660, 76);
      ctx.fillStyle = allSettled ? v("--success") : v("--primary"); ctx.font = "700 30px monospace"; ctx.fillText(stamp, 0, 10);
      ctx.restore();
      ctx.fillStyle = faint; ctx.font = "600 28px Fraunces, serif"; ctx.fillText("tabby", W / 2, bottom - 50);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png"); a.download = `${session.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "tabby"}-receipt.png`; a.click();
      setStatus("Receipt slip downloaded.");
    } catch { setStatus("Couldn't create the receipt on this device."); }
  }

  return <section className="recap-section" aria-label="The Group Chat Receipt">
    <div className="recap-head">
      <h3>🧾 The Group Chat Receipt</h3>
      <p>A tidy receipt slip to drop straight into your WhatsApp or iMessage group chat so everyone is on the same page.</p>
    </div>
    <article className="receipt-slip">
      <span className="receipt-eyebrow">*** Tabby Billing &amp; Settlement ***</span>
      <h4>{session.title}</h4>
      <span className="receipt-meta">DATE: {receiptDate()} • GUEST COUNT: {session.participants.length} • STATUS: ACTIVE</span>
      <hr className="receipt-rule" />
      <ul>
        {session.participants.map(p => <li key={p.id}><span>{p.name}</span><i aria-hidden="true" /><b>{money(p.totalOwed)}</b></li>)}
        <li className="receipt-fees"><span>Shared tax &amp; fees (split evenly)</span><i aria-hidden="true" /><b>{money(taxes)}</b></li>
      </ul>
      <hr className="receipt-rule" />
      <p className="receipt-total">TOTAL TAB: {money(total)}</p>
      <span className={`receipt-stamp${allSettled ? " is-paid" : ""}`}>{stamp}</span>
      <span className="receipt-logo">tabby</span>
    </article>
    <div className="recap-actions">
      <Button variant="tabby" aria-label="Save Receipt Slip" onClick={download}>📥 Save Receipt Slip</Button>
      <Button variant="receipt" aria-label="Copy Group Chat Text" onClick={copyText}>📋 Copy Group Chat Text</Button>
    </div>
    <p role="status" className="recap-status">{status}</p>
  </section>;
}
