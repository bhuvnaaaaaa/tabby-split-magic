import { useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tabGrossTotal, tabOverheadTotal } from "@/lib/tabby-math";
import type { TabSession } from "@/types/tabby";

const DOODLES = ["☕", "🍕", "🥐", "🧾", "🍜", "🥤"];

function settledFor(session: TabSession, id: string) {
  const mine = session.transfers.filter(t => t.from === id || t.to === id);
  return mine.every(t => t.isSettled);
}

export function RecapCard({ session, onShare }: { session: TabSession; onShare: () => void }) {
  const [status, setStatus] = useState("");
  const money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: session.currency, maximumFractionDigits: 2 }).format(n);
  const total = money(tabGrossTotal(session));
  const taxes = money(tabOverheadTotal(session));

  async function download() {
    try {
      await document.fonts?.ready;
      const W = 1080, H = 1920, c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error();
      const css = getComputedStyle(document.querySelector(".tabby-app") ?? document.documentElement);
      const v = (name: string) => css.getPropertyValue(name).trim();
      ctx.fillStyle = v("--secondary"); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = v("--card"); ctx.beginPath(); ctx.roundRect(80, 120, W - 160, H - 240, 48); ctx.fill();
      ctx.textAlign = "center"; ctx.font = "64px serif";
      DOODLES.forEach((d, i) => { ctx.globalAlpha = .55; ctx.fillText(d, 170 + i * 148, 250 + (i % 2) * 40); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = v("--muted-foreground"); ctx.font = "600 30px 'Plus Jakarta Sans', sans-serif"; ctx.fillText("THE GROUP TAB RECAP", W / 2, 420);
      ctx.fillStyle = v("--foreground"); ctx.font = "600 76px Fraunces, serif";
      const words = session.title.split(" "); let line = "", y = 530;
      for (const w of words) { if (ctx.measureText(`${line} ${w}`).width > W - 280 && line) { ctx.fillText(line.trim(), W / 2, y); line = w; y += 90; } else line += ` ${w}`; }
      ctx.fillText(line.trim(), W / 2, y);
      y += 140; ctx.fillStyle = v("--primary"); ctx.font = "600 110px Fraunces, serif"; ctx.fillText(total, W / 2, y);
      y += 60; ctx.fillStyle = v("--muted-foreground"); ctx.font = "500 32px 'Plus Jakarta Sans', sans-serif"; ctx.fillText(`total spent · ${taxes} shared taxes, split evenly`, W / 2, y);
      y += 110; ctx.textAlign = "left";
      for (const p of session.participants.slice(0, 10)) {
        const ok = settledFor(session, p.id);
        ctx.fillStyle = ok ? v("--success") : v("--border"); ctx.beginPath(); ctx.arc(220, y - 12, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = v("--card"); ctx.font = "700 30px sans-serif"; ctx.textAlign = "center"; ctx.fillText(ok ? "✓" : "·", 220, y - 2);
        ctx.textAlign = "left"; ctx.fillStyle = v("--foreground"); ctx.font = "600 40px 'Plus Jakarta Sans', sans-serif"; ctx.fillText(p.name, 280, y);
        ctx.textAlign = "right"; ctx.fillStyle = v("--muted-foreground"); ctx.font = "500 32px 'Plus Jakarta Sans', sans-serif"; ctx.fillText(ok ? "All settled" : "Pending", W - 200, y);
        ctx.textAlign = "left"; y += 90;
      }
      ctx.textAlign = "center"; ctx.fillStyle = v("--primary"); ctx.font = "700 48px Fraunces, serif"; ctx.fillText("tabby", W / 2, H - 200);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png"); a.download = `${session.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "tabby"}-recap.png`; a.click();
      setStatus("Story card downloaded.");
    } catch { setStatus("Couldn’t create the story card on this device."); }
  }

  return <section className="recap-section" aria-label="The Group Tab Recap">
    <div className="recap-head">
      <h3>📸 The Group Tab Recap</h3>
      <p>A little keepsake of the night — download it for Instagram or WhatsApp status, or send the live tab to friends.</p>
    </div>
    <article className="story-card">
      <div className="story-doodles" aria-hidden="true">{DOODLES.map(d => <span key={d}>{d}</span>)}</div>
      <span className="story-eyebrow">THE GROUP TAB RECAP</span>
      <h4>{session.title}</h4>
      <strong className="story-total">{total}</strong>
      <span className="story-badge">{taxes} shared taxes · split evenly</span>
      <ul>{session.participants.map(p => { const ok = settledFor(session, p.id); return <li key={p.id} className={ok ? "is-settled" : ""}><span className="story-check">{ok ? <Check size={13} /> : null}</span>{p.name}<small>{ok ? "All settled" : "Pending"}</small></li>; })}</ul>
      <span className="story-logo">tabby</span>
    </article>
    <div className="recap-actions">
      <Button variant="tabby" aria-label="Download Story Card" onClick={download}><Download />📥 Download Story Card</Button>
      <Button variant="receipt" aria-label="Share Tab Link" onClick={onShare}><Link2 />🔗 Share Tab Link</Button>
    </div>
    <p role="status" className="recap-status">{status}</p>
  </section>;
}
