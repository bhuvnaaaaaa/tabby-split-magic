import { useEffect, useRef, useState } from "react";
import { ArrowRight, Car, Check, CheckCheck, CircleCheck, Copy, CreditCard, House, MessageCircle, Pencil, Pizza, ReceiptText, Send, Share2, Users } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { TransferFlow } from "@/components/transfer-flow";
import { RecapCard } from "@/components/recap-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { calculateTabSession, fromMinorUnits, tabGrossTotal, tabOverheadTotal, toMinorUnits } from "@/lib/tabby-math";
import { expenseCategory, payoutTag, settlementProgress, upiPaymentLink } from "@/lib/tabby-settlement";
import type { TabSession, TransferAction } from "@/types/tabby";

type EditTarget = { kind: "item"; id: string } | { kind: "person"; id: string } | { kind: "tax" };
type Tone = "Casual" | "Playful" | "Corporate joke";
const TONES: Tone[] = ["Casual", "Playful", "Corporate joke"];

export function SettlementDashboard({ session, onChange, dark, friendId, onChooseFriend, onShare }: { session: TabSession; onChange: (tab: TabSession) => void; dark: boolean; friendId: string | null; onChooseFriend: () => void; onShare: () => void }) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [nudgeId, setNudgeId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>("Casual");
  const [upiDraft, setUpiDraft] = useState("");
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [payerDraft, setPayerDraft] = useState("");
  const [splitDraft, setSplitDraft] = useState<string[]>([]);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [vpaCopied, setVpaCopied] = useState(false);
  const [audit, setAudit] = useState<string[]>(["Tab untangled. Balances checked."]);
  const completeBefore = useRef(false);
  const progress = settlementProgress(session.transfers);
  const money = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency: session.currency, maximumFractionDigits: 2 }).format(amount);
  const name = (id: string) => session.participants.find(p => p.id === id)?.name ?? id;
  const payment = session.transfers.find(t => t.id === paymentId);
  const nudge = session.transfers.find(t => t.id === nudgeId);
  const paymentLink = payment ? upiPaymentLink(session, payment) : null;
  const editedItem = edit?.kind === "item" ? session.items.find(i => i.id === edit.id) : undefined;
  const editedPerson = edit?.kind === "person" ? session.participants.find(p => p.id === edit.id) : undefined;
  const hasSettled = session.transfers.some(t => t.isSettled);
  const modalClass = `tabby-modal${dark ? " dark" : ""}`;
  const personalTransfers = session.transfers.filter(t => t.from === friendId && !t.isSettled);
  const pendingMinor = personalTransfers.reduce((sum, t) => sum + toMinorUnits(t.amount), 0);
  const incomingMinor = session.transfers.filter(t => t.to === friendId && !t.isSettled).reduce((sum, t) => sum + toMinorUnits(t.amount), 0);

  useEffect(() => {
    if (progress.complete && !completeBefore.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let cancelled = false;
      void import("canvas-confetti").then(({ default: confetti }) => {
        if (cancelled) return;
        const styles = getComputedStyle(document.querySelector(".tabby-app") ?? document.documentElement);
        const colors = [styles.getPropertyValue("--primary").trim(), styles.getPropertyValue("--terracotta").trim(), styles.getPropertyValue("--success").trim(), styles.getPropertyValue("--secondary").trim()];
        void confetti({ particleCount: 180, spread: 110, startVelocity: 45, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
        window.setTimeout(() => { if (cancelled) return; void confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true }); void confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true }); }, 250);
      });
      completeBefore.current = true;
      return () => { cancelled = true; };
    }
    completeBefore.current = progress.complete;
    return undefined;
  }, [progress.complete]);

  function record(message: string) { setAudit(previous => [message, ...previous].slice(0, 20)); }
  function toggleSettled(t: TransferAction) {
    onChange({ ...session, transfers: session.transfers.map(transfer => transfer.id === t.id ? { ...transfer, isSettled: !transfer.isSettled } : transfer) });
    record(`${name(t.from)} → ${name(t.to)}: ${money(t.amount)} ${t.isSettled ? "reopened" : "marked settled"}.`);
  }
  function startPayment(t: TransferAction) {
    const link = upiPaymentLink(session, t);
    if (link && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) { window.location.href = link; return; }
    setPaymentId(t.id); setUpiDraft(session.participants.find(p => p.id === t.to)?.upiId ?? ""); setError(""); setCopied(false); setVpaCopied(false);
  }
  function saveUpi(id: string, value: string) {
    const upiId = value.trim();
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId)) { setError("Enter a valid UPI ID, such as name@bank."); return false; }
    onChange({ ...session, participants: session.participants.map(p => {
      if (p.id !== id) return p;
      const { upiId: previous, ...details } = p;
      return upiId ? { ...details, upiId } : details;
    }), transfers: session.transfers.map(t => {
      if (t.to !== id) return t;
      const { toUpi: previous, ...details } = t;
      return upiId ? { ...details, toUpi: upiId } : details;
    }) });
    record(`${name(id)}’s UPI ID updated.`); setError(""); return true;
  }
  function startEdit(target: EditTarget) {
    setEdit(target); setError(""); setResetConfirmed(false);
    if (target.kind === "item") {
      const item = session.items.find(i => i.id === target.id);
      if (!item) return;
      setAmountDraft(String(item.amount)); setPayerDraft(item.paidById); setSplitDraft(item.splitAmongIds);
    } else if (target.kind === "tax") setAmountDraft(String(session.sharedTaxes));
    else setUpiDraft(session.participants.find(p => p.id === target.id)?.upiId ?? "");
  }
  function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    if (edit.kind === "person") { if (saveUpi(edit.id, upiDraft)) setEdit(null); return; }
    if (hasSettled && !resetConfirmed) { setError("Confirm resetting settlement marks before changing this split."); return; }
    try {
      const amount = fromMinorUnits(toMinorUnits(amountDraft));
      const updated = calculateTabSession({ ...session, sharedTaxes: edit.kind === "tax" ? amount : session.sharedTaxes, items: session.items.map(i => edit.kind === "item" && i.id === edit.id ? { ...i, amount, paidById: payerDraft, splitAmongIds: i.isOverheadFee ? session.participants.map(p => p.id) : splitDraft } : i) });
      onChange(updated); record(`${edit.kind === "tax" ? "Shared taxes" : editedItem?.title ?? "Expense"} updated. Split recalculated${hasSettled ? "; settlement marks reset" : ""}.`); setEdit(null); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Please check the expense details."); }
  }
  const nudgeLink = nudge ? upiPaymentLink(session, nudge) : null;
  const nudgeText = !nudge ? "" : tone === "Casual" ? `Hey! Settling the ${session.title} tab whenever you get a minute: ${money(nudge.amount)} to ${name(nudge.to)}.${nudgeLink ? ` ${nudgeLink}` : ""}` : tone === "Playful" ? `Coffee on you? ☕🍕 Just sending your ${money(nudge.amount)} share from ${session.title} 😄 No rush… okay, a little rush 🙈` : `Per my last pizza 📊, kindly action the outstanding ${money(nudge.amount)} for ${session.title} by EOD. Let's circle back over dessert.`;

  return <div className="settlement-dashboard">
    <div className="dashboard-title"><div><span className="eyebrow">THE GOOD TIMES, UNTANGLED</span><h2>{session.title}</h2></div><div className="dashboard-tools"><span className="friend-count"><Users size={15} />{session.participants.length} friends</span><Button variant="receipt" aria-label="Share with Friends" onClick={onShare}><Share2 />Share with Friends</Button><Button variant="ghost" aria-label="Which friend are you?" onClick={onChooseFriend}><Users /></Button></div></div>
    {friendId && <section className="personal-balance" aria-label="Your pending balance"><div><span>{name(friendId)}’s pending balance</span><strong>{money(fromMinorUnits(pendingMinor || incomingMinor))}</strong><p>{pendingMinor ? "Left to pay" : incomingMinor ? "Left to receive" : "You’re all settled."}</p></div><div>{personalTransfers.map(t => <Button variant="tabby" key={t.id} aria-label={`Pay ${name(t.to)} ${money(t.amount)}`} disabled={session.currency !== "INR"} onClick={() => startPayment(t)}><CreditCard />Pay {name(t.to)} · {money(t.amount)}</Button>)}</div></section>}
    <div className="metrics-ribbon">
      <div><span>Total Tab Spent</span><strong>{money(tabGrossTotal(session))}</strong></div>
      <div><span>Shared Taxes <small>Split evenly</small></span><strong>{money(tabOverheadTotal(session))}</strong></div>
      <div className="settlement-metric"><span>Settled <b>{progress.percentage}%</b></span><div className="settlement-progress" role="progressbar" aria-label="Payments settled" aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}><svg viewBox="0 0 100 4" preserveAspectRatio="none"><path d="M0 2 H100" pathLength="100" /><path className="progress-fill" d="M0 2 H100" pathLength="100" strokeDasharray={`${progress.percentage} 100`} /></svg></div><small>{session.transfers.filter(t => t.isSettled).length} of {session.transfers.length} payments</small></div>
    </div>
    {progress.complete && <div className="all-settled" role="status"><span className="success-badge"><CheckCheck size={24} /></span><div><h3>All settled! Zero debts left.</h3><p>Good company. A clean slate.</p></div><CircleCheck className="milestone-check" /></div>}
    <div className="settlement-columns">
      <section className="payout-section" aria-label="Direct Payouts"><div className="section-title"><h3>Direct Payouts</h3><span>{session.transfers.length} payments</span></div>
        {session.transfers.length > 0 && <TransferFlow session={session} />}
        <div className="payout-list">{session.transfers.map(t => <article className={`payout-card${t.isSettled ? " is-settled" : ""}${t.from === friendId && !t.isSettled ? " your-payout" : ""}`} key={t.id}>
          <div className="payout-top"><div className="payout-people"><span className="person-avatar">{name(t.from).slice(0, 1)}</span><ArrowRight size={14} /><span className="person-avatar recipient">{name(t.to).slice(0, 1)}</span></div>{t.isSettled ? <span className="settled-badge"><Check size={12} />Settled</span> : (() => { const tag = payoutTag(session, t); return <span className="tone-tag"><span aria-hidden="true">{tag.icon}</span>{tag.label}</span>; })()}</div>
          <div className="payout-amount"><p>{name(t.from)} pays {name(t.to)}</p><strong>{money(t.amount)}</strong></div>
          <div className="payout-actions"><Button variant="tabby" size="sm" onClick={() => startPayment(t)} disabled={t.isSettled || session.currency !== "INR"} title={session.currency !== "INR" ? "UPI supports INR payments only" : undefined}><CreditCard />Pay via UPI</Button><Button variant="receipt" size="sm" onClick={() => { setNudgeId(t.id); setTone("Casual"); }} disabled={t.isSettled}><MessageCircle />Nudge</Button></div>
          {(() => { const canMark = friendId === t.to; return <label className={`settled-toggle${canMark ? "" : " is-locked"}`} title={canMark ? undefined : `Only ${name(t.to)} can confirm this payment`}><input type="checkbox" checked={t.isSettled} disabled={!canMark} onChange={() => toggleSettled(t)} aria-label={`Mark ${name(t.from)} to ${name(t.to)} as settled`} /><span>{t.isSettled ? "Marked as settled" : canMark ? "Mark as Settled" : friendId ? `Only ${name(t.to)} can confirm` : <>Only {name(t.to)} can confirm · <button type="button" className="inline-link" onClick={onChooseFriend}>I’m {name(t.to)}</button></>}</span></label>; })()}
          {session.currency !== "INR" && !t.isSettled && <p className="upi-hint">UPI works for ₹ INR tabs only.</p>}
        </article>)}</div>
      </section>
      <section className="audit-section" aria-label="Itemized Note & Audit Trail"><div className="section-title"><h3>Itemized Note & Audit Trail</h3><ReceiptText size={17} /></div>
        <div className="itemized-list">{session.items.map(item => { const category = expenseCategory(item.title); const Icon = category.label === "Dining" ? Pizza : category.label === "Transport" ? Car : category.label === "Home & stays" ? House : ReceiptText; return <div className="expense-row" key={item.id}><span className="category-icon" title={category.label} aria-label={category.label}><Icon size={17} /></span><div className="expense-detail"><strong>{item.title}</strong><span>Paid by {name(item.paidById)}</span><small>{item.isOverheadFee ? "Split evenly · everyone" : item.splitAmongIds.map(name).join(", ")}</small></div><span className="item-amount">{money(item.amount)}</span><Button size="icon" variant="ghost" aria-label={`Edit ${item.title}`} title={`Edit ${item.title}`} onClick={() => startEdit({ kind: "item", id: item.id })}><Pencil /></Button></div>; })}
          <div className="expense-row tax-row"><span className="category-icon"><ReceiptText size={17} /></span><div className="expense-detail"><strong>Shared taxes & fees</strong><span>Split evenly · everyone</span></div><span className="item-amount">{money(session.sharedTaxes)}</span><Button size="icon" variant="ghost" aria-label="Edit shared taxes" title="Edit shared taxes" onClick={() => startEdit({ kind: "tax" })}><Pencil /></Button></div>
        </div>
        <p className="allocation-note">Odd paise or cents go to {session.participants[0]?.name}. Unassigned taxes are credited to {session.participants[0]?.name}.</p>
        <h4 className="audit-subtitle">Friends & payment details</h4><div className="participant-list">{session.participants.map(p => <div key={p.id}><span className="person-avatar">{p.name.slice(0, 1)}</span><div><strong>{p.name}</strong><small>{p.upiId || "UPI ID not added"}</small></div><span>{money(p.totalOwed)}<small>share</small></span><Button size="icon" variant="ghost" aria-label={`Edit UPI ID for ${p.name}`} title={`Edit UPI ID for ${p.name}`} onClick={() => startEdit({ kind: "person", id: p.id })}><Pencil /></Button></div>)}</div>
        <h4 className="audit-subtitle">Activity</h4><ol className="audit-events">{audit.map((event, i) => <li key={`${i}-${event}`}><Check size={12} /><span>{event}</span></li>)}</ol>
      </section>
    </div>
    <RecapCard session={session} onShare={onShare} />
    <Dialog open={Boolean(payment)} onOpenChange={open => { if (!open) setPaymentId(null); }}><DialogContent className={`${modalClass} payment-modal`}><DialogTitle>Pay {payment ? name(payment.to) : "your friend"}</DialogTitle><DialogDescription>{payment ? `${money(payment.amount)} · ${name(payment.from)}’s share` : ""}</DialogDescription>
      {paymentLink ? <><div className="payment-qr"><QRCodeCanvas value={paymentLink} size={220} level="M" marginSize={4} fgColor="#241a2f" bgColor="#ffffff" title="UPI payment QR code" role="img" aria-label="UPI payment QR code" /></div><div className="qr-recipient"><span>{session.participants.find(p => p.id === payment?.to)?.upiId}</span><Button size="sm" variant="ghost" aria-label="Copy UPI ID" onClick={async () => { try { await navigator.clipboard.writeText(session.participants.find(p => p.id === payment?.to)?.upiId ?? ""); setVpaCopied(true); } catch { setError("Couldn’t copy the UPI ID."); } }}><Copy />{vpaCopied ? "Copied" : "Copy VPA"}</Button></div><Button variant="tabby" asChild><a href={paymentLink}><CreditCard />Open UPI app</a></Button><Button variant="receipt" onClick={async () => { try { await navigator.clipboard.writeText(paymentLink); setCopied(true); } catch { setError("Couldn’t copy the payment link."); } }}><Copy />{copied ? "Copied" : "Copy payment link"}</Button><p className="payment-note">Confirm the recipient in your payment app. Payments aren’t verified automatically.</p></> : <form onSubmit={event => { event.preventDefault(); if (payment) saveUpi(payment.to, upiDraft); }} className="edit-form"><label>{payment ? name(payment.to) : "Recipient"}’s UPI ID<input aria-label="Recipient UPI ID" value={upiDraft} onChange={e => setUpiDraft(e.target.value)} placeholder="name@bank" required /></label><Button variant="tabby" type="submit">Save UPI ID <ArrowRight /></Button></form>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </DialogContent></Dialog>
    <Sheet open={Boolean(nudge)} onOpenChange={open => { if (!open) setNudgeId(null); }}><SheetContent side="bottom" className={`${modalClass} nudge-sheet`}><div className="sheet-handle" /><SheetTitle>A little nudge, no awkwardness.</SheetTitle><SheetDescription>{nudge ? `A note for ${name(nudge.from)} · ${money(nudge.amount)}` : ""}</SheetDescription><div className="tone-toggle" aria-label="Nudge tone">{TONES.map(value => <Button key={value} variant={tone === value ? "currency" : "ghost"} aria-pressed={tone === value} onClick={() => setTone(value)}>{value}</Button>)}</div><p className="nudge-preview">{nudgeText}</p><Button variant="tabby" asChild><a href={`https://wa.me/?text=${encodeURIComponent(nudgeText)}`} target="_blank" rel="noopener noreferrer"><Send />Send via WhatsApp</a></Button></SheetContent></Sheet>
    <Dialog open={Boolean(edit)} onOpenChange={open => { if (!open) setEdit(null); }}><DialogContent className={modalClass}><DialogTitle>{edit?.kind === "person" ? `${editedPerson?.name}’s payment details` : edit?.kind === "tax" ? "Edit shared taxes" : `Edit ${editedItem?.title ?? "expense"}`}</DialogTitle><DialogDescription>{edit?.kind === "person" ? "UPI payment details" : "Expense details"}</DialogDescription><form onSubmit={saveEdit} className="edit-form">
      {edit?.kind === "person" ? <label>UPI ID<input aria-label="UPI ID" value={upiDraft} placeholder="name@bank" onChange={e => setUpiDraft(e.target.value)} /></label> : <><label>Amount ({session.currency})<input aria-label="Expense amount" type="number" min="0" step="0.01" required value={amountDraft} onChange={e => setAmountDraft(e.target.value)} /></label>{edit?.kind === "item" && <><label>Paid by<select aria-label="Paid by" value={payerDraft} onChange={e => setPayerDraft(e.target.value)}>{session.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><fieldset><legend>Split among</legend>{session.participants.map(p => <label className="split-person" key={p.id}><input type="checkbox" checked={editedItem?.isOverheadFee || splitDraft.includes(p.id)} disabled={editedItem?.isOverheadFee} onChange={e => setSplitDraft(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />{p.name}</label>)}</fieldset></>}{hasSettled && <label className="reset-warning"><input type="checkbox" checked={resetConfirmed} onChange={e => setResetConfirmed(e.target.checked)} />Reset settlement marks and recalculate payments</label>}</>}
      {error && <p className="form-error" role="alert">{error}</p>}<div className="edit-actions"><Button variant="receipt" type="button" onClick={() => setEdit(null)}>Cancel</Button><Button variant="tabby" type="submit"><Check />Save changes</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}