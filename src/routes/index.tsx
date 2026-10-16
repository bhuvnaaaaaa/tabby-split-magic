import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, CheckCheck, ChevronDown, Copy, Heart, LoaderCircle, MessageCircle, Moon, ReceiptText, ShieldCheck, Sun, X } from "lucide-react";
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

const examples = [
  { label: "Road trip cabin", text: "4 of us went on a road trip. Maya paid 8000 for the cabin, Rohan paid 2400 for fuel. Tax was 400. Split equally." },
  { label: "Weekend dinner & cabs", text: "4 of us grabbed pizza and cabs. Maya paid 1800 for food, Rohan paid 600 for cab. Tax was 120. Split equally." },
  { label: "Monthly flat utilities", text: "3 of us share a flat. Maya paid 2400 for electricity, Rohan paid 900 for internet. Tax was 150. Split equally." },
];
type Settlement = { from: string; to: string; amount: number };
type Split = { total: number; each: number; people: number; tax: number; transfers: Settlement[] };

function splitNotes(notes: string): Split | null {
  const payments = [...notes.matchAll(/([A-Z][a-z]+)\s+paid\s+[₹$€]?\s*([\d,]+(?:\.\d+)?)/gi)].map(m => ({ name: m[1], amount: Number(m[2].replaceAll(",", "")) }));
  const count = Number(notes.match(/(\d+)\s+(?:of us|people|friends|roommates)/i)?.[1]);
  const tax = Number(notes.match(/tax\s*(?:was|is|of|:)?\s*[₹$€]?\s*([\d,]+(?:\.\d+)?)/i)?.[1]?.replaceAll(",", "") ?? 0);
  const names = [...new Set(payments.map(p => p.name))];
  if (!payments.length || !Number.isInteger(count) || count < names.length || count > 30 || count < 2) return null;
  const total = payments.reduce((sum, p) => sum + p.amount, 0) + tax;
  const each = total / count;
  // Unassigned tax is fronted by the first payer; everyone shares it equally.
  const balances = Array.from({ length: count }, (_, i) => ({ name: names[i] ?? `Friend ${i - names.length + 1}`, balance: payments.filter(p => p.name === names[i]).reduce((s, p) => s + p.amount, 0) + (i === 0 ? tax : 0) - each }));
  const creditors = balances.filter(p => p.balance > 0.005);
  const debtors = balances.filter(p => p.balance < -0.005);
  const transfers: Settlement[] = [];
  for (const debtor of debtors) for (const creditor of creditors) {
    const amount = Math.min(-debtor.balance, creditor.balance);
    if (amount > 0.005) { transfers.push({ from: debtor.name, to: creditor.name, amount }); debtor.balance += amount; creditor.balance -= amount; }
  }
  return { total, each, people: count, tax, transfers };
}

function Index() {
  const [currency, setCurrency] = useState("INR");
  const [dark, setDark] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => () => { if (receipt) URL.revokeObjectURL(receipt.url); }, [receipt]);
  const money = (value: number) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  function untangle() {
    if (!notes.trim()) { setError("Add a few notes about who paid and how many friends shared the tab."); return; }
    setError(""); setResult(null); setPreview(false); setLoading(true);
    timer.current = setTimeout(() => {
      const split = splitNotes(notes);
      setResult(split); setLoading(false);
      if (!split) setError("For this demo, include the group size and payments like ‘4 of us. Maya paid 1800’. Or try an example below.");
    }, 1800);
  }
  async function copyTransfer(t: Settlement, i: number) {
    try { await navigator.clipboard.writeText(`${t.from} owes ${t.to} ${money(t.amount)}. Settled with Tabby.`); setCopied(i); }
    catch { setError("Your browser couldn’t copy the settlement. You can select and copy the amount instead."); }
  }
  return <div className={dark ? "tabby-app dark" : "tabby-app"}>
    <header className="site-header">
      <a href="/" className="wordmark" aria-label="Tabby home">tabby<span className="logo-mark"><ReceiptText size={13} strokeWidth={1.8} /></span></a>
      <div className="header-controls">
        <div className="currency-switch" aria-label="Currency">{[["INR", "₹"], ["USD", "$"], ["EUR", "€"]].map(([code, symbol]) => <Button key={code} size="sm" variant={currency === code ? "currency" : "ghost"} aria-pressed={currency === code} onClick={() => setCurrency(code)}>{symbol} <span>{code}</span></Button>)}</div>
        <span className="header-divider" />
        <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
      </div>
    </header>
    <main>
      <section className="intro">
        <div className="eyebrow"><span className="small-dot" /> LESS MATH. MORE MEMORIES.</div>
        <h1>Good times with friends,<br />settled without the <em>awkward math.</em></h1>
        <p className="intro-copy">Paste your dinner notes, trip recap, or upload a bill. We’ll untangle who paid,<br className="desktop-break" /> split shared taxes equally, and give you clean 1-tap links.</p>
      </section>
      <section className="workspace" aria-label="Split a tab">
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
          <div className="results-heading"><h2>{loading || preview ? "A little untangling…" : "All clear. Here’s the split."}</h2><span>{loading || preview ? "Finding the fairest way" : `${result?.people} friends · ${money(result?.total ?? 0)} total`}</span></div>
          {loading || preview ? <div className="transaction-grid" aria-label="Loading settlements">{[0, 1, 2].map(i => <div className="transaction-card skeleton-card animate-pulse" key={i}><div className="skeleton-avatar" /><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-button" /></div>)}</div> : result && <><p className="split-note">{money(result.each)} per person, including {money(result.tax / result.people)} in shared tax. Unassigned tax is credited to the first payer. Unnamed friends are numbered.</p><div className="transaction-grid">{result.transfers.map((t, i) => <div className="transaction-card" key={`${t.from}-${t.to}`}><span className="transaction-avatar">{t.from[0]}</span><p>{t.from} <ArrowRight size={13} /> {t.to}</p><strong>{money(t.amount)}</strong><Button variant="receipt" onClick={() => copyTransfer(t, i)}>{copied === i ? <CheckCheck /> : <Copy />}{copied === i ? "Copied" : "Copy settlement"}</Button></div>)}</div><p className="demo-note">Simulated equal split · Currency changes the denomination, not the exchange rate. Payment links aren’t connected yet.</p></>}
        </section>}
      </section>
      <section className="closing"><img src={meal} width={768} height={512} alt="A shared pizza on a lavender plate, with a glass and terracotta napkin" loading="lazy" /><h2>Keep the memories.<br /><span>Not the mental math.</span></h2><p>For the dinners that run late, the trips worth taking,<br />and the people you’d do it all again with.</p><div className="closing-details"><span><ReceiptText /> Any shared expense</span><span><CheckCheck /> A fair, simple split</span><span><MessageCircle /> Less awkward chats</span></div></section>
    </main>
    <footer><span className="footer-logo">tabby<span className="small-dot" /></span><span>A little less owing. A little more living.</span><span>Made for good company <Heart size={12} /></span></footer>
  </div>;
}
