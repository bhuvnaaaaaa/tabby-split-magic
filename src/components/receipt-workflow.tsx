import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FoodLoader } from "@/components/food-loader";
import { Camera, Check, ImagePlus, Plus, ReceiptText, X } from "lucide-react";
import { readReceipt } from "@/lib/tabby.functions";
import { calculateTabSession, fromMinorUnits, toMinorUnits } from "@/lib/tabby-math";
import type { TabSession } from "@/types/tabby";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ReceiptWorkflow({ open, onOpenChange, currency, current, dark, onComplete }: { open: boolean; onOpenChange: (open: boolean) => void; currency: string; current: TabSession | null; dark: boolean; onComplete: (tab: TabSession) => void }) {
  const parse = useServerFn(readReceipt);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null);
  const [draft, setDraft] = useState<TabSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payer, setPayer] = useState("");
  const [dragging, setDragging] = useState(false);
  const active = useRef(false);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => {
    if (!draft || draft.participants.some(p => p.id === payer)) return;
    setPayer(draft.participants[0]?.id ?? "");
  }, [draft, payer]);

  async function choose(file: File) {
    if (active.current) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000 || !file.size) { setError("Choose a JPEG, PNG or WebP receipt photo smaller than 5 MB."); return; }
    setPhoto({ name: file.name, url: URL.createObjectURL(file) }); setDraft(null); setBusy(true); active.current = true;
    try {
      const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Couldn’t read this image.")); reader.onerror = () => reject(new Error("Couldn’t read this image.")); reader.readAsDataURL(file); });
      const result = await parse({ data: { image, currency: currency as "INR" | "USD" | "EUR" } });
      if (!result.ok) throw new Error(result.error);
      const participants = current?.participants ?? result.session.participants;
      const first = participants[0];
      if (!first) throw new Error("Add a friend to continue.");
      const ids = participants.map(p => p.id);
      setDraft({ ...result.session, participants, items: result.session.items.map(item => ({ ...item, paidById: first.id, splitAmongIds: ids })) }); setPayer(first.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Receipt reading is unavailable. Try again later or paste the amounts into your notes."); }
    finally { setBusy(false); active.current = false; }
  }
  function submit() {
    if (!draft) return;
    try {
      if (draft.participants.some(p => !p.name.trim())) throw new Error("Add a name for every friend.");
      const session = calculateTabSession({ ...draft, participants: draft.participants.map(p => ({ ...p, name: p.name.trim() })), items: draft.items.map(item => ({ ...item, paidById: payer, splitAmongIds: item.isOverheadFee ? draft.participants.map(p => p.id) : item.splitAmongIds })) });
      onComplete(session); onOpenChange(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Check each item’s amount and assigned friends."); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className={`tabby-modal receipt-modal${dark ? " dark" : ""}`} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}><DialogTitle>{draft ? "Who ordered what?" : "Bring the bill."}</DialogTitle><DialogDescription>{draft ? "Review receipt amounts and friends before settling." : "JPEG, PNG or WebP · up to 5 MB"}</DialogDescription>
    {!draft && <div className={`receipt-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void choose(file); }}>
      {photo ? <img src={photo.url} alt="Receipt being read" /> : <ImagePlus size={34} />}
      {busy ? <FoodLoader compact /> : <><p>Drop your receipt photo here</p><div className="receipt-upload-actions"><Button variant="tabby" onClick={() => fileRef.current?.click()} aria-label="Choose receipt photo"><ImagePlus />Choose photo</Button><Button variant="receipt" onClick={() => cameraRef.current?.click()} aria-label="Take receipt photo"><Camera />Take photo</Button></div></>}
    </div>}
    <input ref={fileRef} type="file" className="hidden" aria-label="Receipt photo" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ""; }} />
    <input ref={cameraRef} type="file" className="hidden" aria-label="Camera receipt photo" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ""; }} />
    {draft && <div className="receipt-assignment"><div className="receipt-review-header">{photo && <img src={photo.url} alt="Original receipt" />}<div><h3>{draft.title}</h3><span>{draft.items.length} extracted lines</span></div><Button variant="ghost" aria-label="Choose another receipt" onClick={() => setDraft(null)}><Camera /></Button></div>
      <div className="receipt-friends">{draft.participants.map(p => <label key={p.id}><span className="person-avatar">{p.name.slice(0, 1)}</span><input aria-label={`Friend name ${p.id}`} value={p.name} maxLength={100} onChange={e => setDraft({ ...draft, participants: draft.participants.map(friend => friend.id === p.id ? { ...friend, name: e.target.value } : friend) })} />{draft.participants.length > 2 && <Button size="icon" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => setDraft({ ...draft, participants: draft.participants.filter(friend => friend.id !== p.id), items: draft.items.map(item => ({ ...item, splitAmongIds: item.splitAmongIds.filter(id => id !== p.id) })) })}><X /></Button>}</label>)}<Button variant="receipt" aria-label="Add friend" disabled={draft.participants.length >= 30} onClick={() => { const id = crypto.randomUUID(); setDraft({ ...draft, participants: [...draft.participants, { id, name: `Friend ${draft.participants.length}`, totalPaid: 0, totalOwed: 0, netBalance: 0 }], items: draft.items.map(item => item.isOverheadFee ? { ...item, splitAmongIds: [...item.splitAmongIds, id] } : item) }); }}><Plus />Add friend</Button></div>
      <label className="receipt-payer">Who paid the bill?<select aria-label="Receipt payer" value={payer} onChange={e => setPayer(e.target.value)}>{draft.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="assignment-items">{draft.items.map(item => <div className="assignment-row" key={item.id}><div className="assignment-item-heading"><label>{item.title}<input aria-label={`Amount for ${item.title}`} type="number" min="0" step="0.01" value={item.amount} onChange={e => { try { const amount = fromMinorUnits(toMinorUnits(e.target.value)); setDraft({ ...draft, items: draft.items.map(i => i.id === item.id ? { ...i, amount } : i) }); setError(""); } catch { setError("Use a non-negative amount with at most two decimals."); } }} /></label><span>{currency}</span></div>
        {item.isOverheadFee ? <span className="shared-fee"><Check size={13} />Split evenly · everyone</span> : <div className="assignment-chips">{draft.participants.map(p => <Button key={p.id} variant={item.splitAmongIds.includes(p.id) ? "currency" : "receipt"} aria-label={`Assign ${item.title} to ${p.name}`} aria-pressed={item.splitAmongIds.includes(p.id)} onClick={() => setDraft({ ...draft, items: draft.items.map(i => i.id === item.id ? { ...i, splitAmongIds: i.splitAmongIds.includes(p.id) ? i.splitAmongIds.filter(id => id !== p.id) : [...i.splitAmongIds, p.id] } : i) })}><span className="chip-initial">{p.name.slice(0, 1)}</span>{p.name}</Button>)}</div>}
      </div>)}</div><Button variant="tabby" aria-label="Confirm receipt split" onClick={submit}><ReceiptText />Confirm split</Button>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </DialogContent></Dialog>;
}