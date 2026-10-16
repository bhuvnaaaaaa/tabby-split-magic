import { useServerFn } from "@tanstack/react-start";
import { parseTab } from "@/lib/tabby.functions";
import { parseTabReliably } from "@/lib/tabby-parser";
import { TABBY_EXAMPLES as examples } from "@/lib/tabby-local";
import type { TabSession } from "@/types/tabby";
import { SettlementDashboard } from "@/components/settlement-dashboard";
import { ReceiptWorkflow } from "@/components/receipt-workflow";
import { decodeTabHash, encodeTabHash } from "@/lib/tabby-share";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, CheckCheck, ChevronDown, Heart, LoaderCircle, MessageCircle, Moon, ReceiptText, ShieldCheck, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import friends from "@/assets/friends-coffee.webp";
import { FoodLoader, LOADER_MIN_MS, wait } from "@/components/food-loader";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Tabby — Split the tab, keep the good times" },
    { name: "description", content: "Read a receipt photo, assign shared expenses, and share a tab with friends. Settle precise balances without the awkward math." },
    { property: "og:title", content: "Tabby — Split the tab, keep the good times" },
    { property: "og:description", content: "Good times with friends, settled without the awkward math." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const CURRENCIES = [{ code: "INR", symbol: "₹" }, { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }] as const;

function Index() {
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR">("INR");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [dark, setDark] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TabSession | null>(null);
  const [error, setError] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [sampleTrigger, setSampleTrigger] = useState(0);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [friendId, setFriendId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shared, setShared] = useState(false);
  const parseOnline = useServerFn(parseTab);
  const [parseNotice, setParseNotice] = useState("");
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  useEffect(() => {
    function hydrate() { try { const tab = decodeTabHash(window.location.hash); if (tab) { setResult(tab); setCurrency(tab.currency as "INR" | "USD" | "EUR"); setShared(true); setFriendId(null); setIdentityOpen(true); setError(""); } } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t open this tab link."); } }
    hydrate(); window.addEventListener("hashchange", hydrate); return () => window.removeEventListener("hashchange", hydrate);
  }, []);
  function updateTab(tab: TabSession) {
    setResult(tab);
    if (shared) { try { history.replaceState(null, "", encodeTabHash(tab)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the share link."); } }
  }
  function shareTab() {
    if (!result) return;
    try { const hash = encodeTabHash(result); history.replaceState(null, "", hash); setShared(true); setShareUrl(`${window.location.origin}${window.location.pathname}${hash}`); setShareStatus(""); setShareOpen(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create a share link."); }
  }
  async function untangle() {
    if (!notes.trim()) { setError("Add a few notes about who paid and how many friends shared the tab."); return; }
    setError(""); setResult(null); setLoading(true); setParseNotice("");
    setShared(false); setFriendId(null); history.replaceState(null, "", window.location.pathname);
    try {
      const [parsed] = await Promise.all([parseTabReliably(notes, currency, () => parseOnline({ data: { notes, currency } }), !navigator.onLine), wait(LOADER_MIN_MS)]);
      setResult(parsed.session);
      setParseNotice(parsed.warning ?? "");
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t read the tab. Please try an example."); }
    finally { setLoading(false); }
  }
  return <div className={dark ? "tabby-app dark" : "tabby-app"}>
    <header className="site-header">
      <a href="/" className="wordmark" aria-label="Tabby home">tabby<span className="logo-mark"><ReceiptText size={13} strokeWidth={1.8} /></span></a>
      <div className="header-controls">
        <div className="currency-switch" aria-label="Currency">{CURRENCIES.map(({ code, symbol }) => <Button key={code} size="sm" variant={currency === code ? "currency" : "ghost"} aria-pressed={currency === code} onClick={() => setCurrency(code)}>{symbol} <span>{code}</span></Button>)}</div>
        <div className="currency-compact">
          <Button variant="ghost" size="sm" className="currency-pill" aria-haspopup="true" aria-expanded={currencyMenuOpen} aria-label="Change currency" onClick={() => setCurrencyMenuOpen(o => !o)}>{CURRENCIES.find(c => c.code === currency)?.symbol} {currency} <ChevronDown size={13} /></Button>
          {currencyMenuOpen && <><button type="button" className="menu-backdrop" aria-hidden="true" tabIndex={-1} onClick={() => setCurrencyMenuOpen(false)} /><div className="currency-menu" role="menu">{CURRENCIES.map(({ code, symbol }) => <Button key={code} role="menuitemradio" aria-checked={currency === code} variant={currency === code ? "currency" : "ghost"} onClick={() => { setCurrency(code); setCurrencyMenuOpen(false); }}>{symbol} {code}</Button>)}</div></>}
        </div>
        <span className="header-divider" />
        <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} onClick={() => { const next = !dark; document.documentElement.classList.toggle("dark", next); setDark(next); }}>{dark ? <Sun /> : <Moon />}</Button>
      </div>
    </header>
    <main>
      {!shared && <section className="intro">
        <div className="hero-title"><div className="hero-text"><div className="eyebrow"><span className="small-dot" /> LESS MATH. MORE MEMORIES.</div><h1>Good times with friends, settled without the <em>awkward math.</em></h1><p className="intro-copy">Paste your dinner notes, trip recap, or upload a bill. We’ll untangle who paid, split shared taxes equally, and give you clean 1-tap links.</p></div><div className="hero-cluster" aria-hidden="true"><img src={friends} width={560} height={560} alt="" className="hero-art" fetchPriority="high" decoding="async" /></div></div>
      </section>}
      <section className={result ? "workspace has-result" : "workspace"} aria-label="Split a tab">
        {!shared && <div className="input-card">
          <div className="input-heading"><span className="input-icon"><ReceiptText size={20} /></span><div><h2>Every good time has a tab.</h2><p>Tell us about yours.</p></div><span className="little-note">Messy notes welcome <Heart size={13} /></span></div>
          <textarea ref={notesRef} aria-label="Your tab notes" value={notes} onChange={e => { setNotes(e.target.value); setError(""); }} placeholder="e.g., 4 of us grabbed pizza and cabs. Maya paid 1800 for food, Rohan paid 600 for cab. Tax was 120. Split equally." maxLength={5000} />
          <div className="examples"><span>Or try a little inspiration</span><div className="example-buttons">{examples.map(example => <Button variant="example" size="sm" key={example.label} onClick={() => { setNotes(example.text); setError(""); notesRef.current?.focus(); }}>{example.label}<ArrowRight size={12} /></Button>)}</div></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="input-actions"><Button variant="tabby" size="lg" disabled={loading} onClick={untangle}>{loading ? <><LoaderCircle className="animate-spin" /> Untangling…</> : <>Untangle Tab <ArrowRight /></>}</Button><Button variant="receipt" size="lg" onClick={() => setReceiptOpen(true)}><Camera />Upload Receipt</Button><span className="private-note"><ShieldCheck size={14} />Just between friends.</span></div>
          <div className="sample-receipt-line"><span>Or</span><Button variant="link" size="sm" aria-label="Try a sample cafe receipt" onClick={() => { setReceiptOpen(true); setSampleTrigger(t => t + 1); }}>Try a sample cafe receipt <ArrowRight size={12} /></Button></div>
        </div>}
        {!shared && <div className="below-input"><span><Check size={14} /> Shared taxes, shared fairly <span className="separator-dot">·</span> No sign-up, no fuss</span></div>}
        {shared && error && <p className="form-error" role="alert">{error}</p>}
        {(loading || result) && <section className="results" aria-live="polite" aria-busy={loading}>
          {loading ? <FoodLoader /> : result && <><SettlementDashboard session={result} onChange={updateTab} dark={dark} friendId={friendId} onChooseFriend={() => setIdentityOpen(true)} onShare={shareTab} />{parseNotice && <p className="demo-note" role="status">{parseNotice}</p>}</>}
        </section>}
      </section>
      <section className="closing"><h2>Keep the memories.<br /><span>Not the mental math.</span></h2><p>For the dinners that run late, the trips worth taking,<br />and the people you’d do it all again with.</p><div className="closing-details"><span><ReceiptText /> Any shared expense</span><span><CheckCheck /> A fair, simple split</span><span><MessageCircle /> Less awkward chats</span></div></section>
    </main>
    <ReceiptWorkflow open={receiptOpen} onOpenChange={setReceiptOpen} currency={currency} current={result} dark={dark} sampleTrigger={sampleTrigger} onComplete={tab => { setResult(tab); setShared(false); setFriendId(null); setParseNotice(""); history.replaceState(null, "", window.location.pathname); }} />
    <Dialog open={identityOpen} onOpenChange={setIdentityOpen}><DialogContent className={`tabby-modal${dark ? " dark" : ""}`}><DialogTitle>Which friend are you?</DialogTitle><DialogDescription>{result?.title}</DialogDescription><div className="identity-friends">{result?.participants.map(p => <Button key={p.id} variant="receipt" aria-label={`I am ${p.name}`} onClick={() => { setFriendId(p.id); setIdentityOpen(false); }}><span className="person-avatar">{p.name.slice(0, 1)}</span>{p.name}</Button>)}</div></DialogContent></Dialog>
    <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent className={`tabby-modal${dark ? " dark" : ""}`}><DialogTitle>Share the tab.</DialogTitle><DialogDescription>Anyone with this link can see names, expenses and UPI IDs. It’s an editable snapshot, not a live payment record.</DialogDescription><label className="share-link-label">Friend link<input aria-label="Shareable tab link" readOnly value={shareUrl} onFocus={e => e.target.select()} /></label><Button variant="tabby" aria-label="Copy friend link" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setShareStatus("Link copied."); } catch { setShareStatus("Select and copy the link above."); } }}>Copy link</Button><p role="status">{shareStatus}</p></DialogContent></Dialog>
    <Toaster position="bottom-center" />
    <footer><span className="footer-logo">tabby<span className="small-dot" /></span><span>A little less owing. A little more living.</span><span>Made for good company <Heart size={12} /></span></footer>
  </div>;
}
