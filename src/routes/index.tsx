import { useServerFn } from "@tanstack/react-start";
import { parseTab } from "@/lib/tabby.functions";
import { parseTabReliably } from "@/lib/tabby-parser";
import { TABBY_EXAMPLES as examples } from "@/lib/tabby-local";
import type { TabSession } from "@/types/tabby";
import { SettlementDashboard } from "@/components/settlement-dashboard";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, CheckCheck, Heart, LoaderCircle, MessageCircle, Moon, ReceiptText, ShieldCheck, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import meal from "@/assets/shared-meal.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Tabby — Split the tab, keep the good times" },
    { name: "description", content: "Paste dinner notes, a trip recap, or select a receipt. Tabby helps untangle shared expenses without the awkward math." },
    { property: "og:title", content: "Tabby — Split the tab, keep the good times" },
    { property: "og:description", content: "Good times with friends, settled without the awkward math." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [currency, setCurrency] = useState("INR");
  const [dark, setDark] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<TabSession | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parseOnline = useServerFn(parseTab);
  const [parseNotice, setParseNotice] = useState("");
  useEffect(() => () => { if (receipt) URL.revokeObjectURL(receipt.url); }, [receipt]);
  async function untangle() {
    if (!notes.trim()) { setError("Add a few notes about who paid and how many friends shared the tab."); return; }
    setError(""); setResult(null); setPreview(false); setLoading(true); setParseNotice("");
    try {
      const parsed = await parseTabReliably(notes, currency, () => parseOnline({ data: { notes, currency } }), !navigator.onLine);
      setResult(parsed.session);
      setParseNotice(parsed.warning ?? "");
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t read the tab. Please try an example."); }
    finally { setLoading(false); }
  }
  return <div className={dark ? "tabby-app dark" : "tabby-app"}>
    <header className="site-header">
      <a href="/" className="wordmark" aria-label="Tabby home">tabby<span className="logo-mark"><ReceiptText size={13} strokeWidth={1.8} /></span></a>
      <div className="header-controls">
        <div className="currency-switch" aria-label="Currency">{([{ code: "INR", symbol: "₹" }, { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }]).map(({ code, symbol }) => <Button key={code} size="sm" variant={currency === code ? "currency" : "ghost"} aria-pressed={currency === code} onClick={() => setCurrency(code)}>{symbol} <span>{code}</span></Button>)}</div>
        <span className="header-divider" />
        <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
      </div>
    </header>
    <main>
      <section className="intro">
        <div className="eyebrow"><span className="small-dot" /> LESS MATH. MORE MEMORIES.</div>
        <div className="hero-title"><h1>Good times with friends,<br /> settled without the <em>awkward math.</em></h1><img src={meal} alt="Friends’ shared dinner" className="hero-vignette" /></div>
        <p className="intro-copy">Paste your dinner notes, trip recap, or upload a bill. We’ll untangle who paid,<br className="desktop-break" /> split shared taxes equally, and give you clean 1-tap links.</p>
      </section>
      <section className={result ? "workspace has-result" : "workspace"} aria-label="Split a tab">
        <div className="input-card">
          <div className="input-heading"><span className="input-icon"><ReceiptText size={20} /></span><div><h2>Every good time has a tab.</h2><p>Tell us about yours.</p></div><span className="little-note">Messy notes welcome <Heart size={13} /></span></div>
          <textarea aria-label="Your tab notes" value={notes} onChange={e => { setNotes(e.target.value); setError(""); }} placeholder="e.g., 4 of us grabbed pizza and cabs. Maya paid 1800 for food, Rohan paid 600 for cab. Tax was 120. Split equally." maxLength={5000} />
          <div className="examples"><span>Or try a little inspiration</span><div className="example-buttons">{examples.map(example => <Button variant="example" size="sm" key={example.label} onClick={() => { setNotes(example.text); setResult(null); setError(""); }}>{example.label}<ArrowRight size={12} /></Button>)}</div></div>
          {receipt && <div className="receipt-preview"><img src={receipt.url} alt="Selected receipt" /><div><strong>{receipt.name}</strong><p>Receipt selected. Add its amounts to your notes for this demo.</p></div><Button variant="ghost" size="icon" aria-label="Remove receipt" onClick={() => setReceipt(null)}><X /></Button></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="input-actions"><Button variant="tabby" size="lg" disabled={loading} onClick={untangle}>{loading ? <><LoaderCircle className="animate-spin" /> Untangling…</> : <>Untangle Tab <ArrowRight /></>}</Button><Button variant="receipt" size="lg" onClick={() => inputRef.current?.click()}><Camera />Upload Receipt</Button><span className="private-note"><ShieldCheck size={14} />Just between friends.</span></div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Select a receipt image" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setError("Please choose a receipt image."); return; } if (file.size > 10 * 1024 * 1024) { setError("Please choose an image smaller than 10 MB."); return; } setReceipt({ name: file.name, url: URL.createObjectURL(file) }); e.target.value = ""; }} />
        </div>
        <div className="below-input"><span><Check size={14} /> Shared taxes, shared fairly <span className="separator-dot">·</span> No sign-up, no fuss</span><label className="skeleton-toggle"><input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} disabled={loading} />Preview loading</label></div>
        {(loading || preview || result) && <section className="results" aria-live="polite" aria-busy={loading || preview}>
          {loading || preview ? <><div className="results-heading"><h2>A little untangling…</h2><span>Finding the fairest way</span></div><div className="transaction-grid" aria-label="Loading settlements">{[0, 1, 2].map(i => <div className="transaction-card skeleton-card animate-pulse" key={i}><div className="skeleton-avatar" /><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-button" /></div>)}</div></> : result && <><SettlementDashboard session={result} onChange={setResult} dark={dark} />{parseNotice && <p className="demo-note" role="status">{parseNotice}</p>}</>}
        </section>}
      </section>
      <section className="closing"><img src={meal} width={768} height={512} alt="A shared pizza on a lavender plate, with a glass and terracotta napkin" loading="lazy" /><h2>Keep the memories.<br /><span>Not the mental math.</span></h2><p>For the dinners that run late, the trips worth taking,<br />and the people you’d do it all again with.</p><div className="closing-details"><span><ReceiptText /> Any shared expense</span><span><CheckCheck /> A fair, simple split</span><span><MessageCircle /> Less awkward chats</span></div></section>
    </main>
    <footer><span className="footer-logo">tabby<span className="small-dot" /></span><span>A little less owing. A little more living.</span><span>Made for good company <Heart size={12} /></span></footer>
  </div>;
}
