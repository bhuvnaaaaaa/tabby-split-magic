import type { TabSession } from "@/types/tabby";

/** Visual map of the simplified payments: debtor avatar -> creditor avatar. */
export function TransferFlow({ session }: { session: TabSession }) {
  const people = session.participants;
  const W = 520, H = 230, cx = W / 2, cy = H / 2, rx = 200, ry = 78;
  const pos = new Map(people.map((p, i) => {
    const a = (i / people.length) * Math.PI * 2 - Math.PI / 2;
    return [p.id, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }];
  }));
  const r = people.length > 12 ? 11 : 19;
  return <figure className="transfer-flow" aria-label="Who pays whom">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={session.transfers.map(t => `${people.find(p => p.id === t.from)?.name} pays ${people.find(p => p.id === t.to)?.name}`).join(", ")}>
      <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="flow-arrow-head" /></marker></defs>
      {session.transfers.map(t => {
        const a = pos.get(t.from), b = pos.get(t.to);
        if (!a || !b) return null;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const sx = a.x + dx / len * (r + 3), sy = a.y + dy / len * (r + 3), ex = b.x - dx / len * (r + 6), ey = b.y - dy / len * (r + 6);
        const mx = (sx + ex) / 2 - dy / len * 22, my = (sy + ey) / 2 + dx / len * 22;
        return <path key={t.id} d={`M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`} className={t.isSettled ? "flow-line is-settled" : "flow-line"} markerEnd="url(#flow-arrow)" />;
      })}
      {people.map(p => { const at = pos.get(p.id)!; const owes = p.netBalance < 0; return <g key={p.id} className={owes ? "flow-node debtor" : "flow-node"}>
        <circle cx={at.x} cy={at.y} r={r} />
        <text x={at.x} y={at.y + 4} textAnchor="middle" className="flow-initial">{p.name.slice(0, 1)}</text>
        {people.length <= 12 && <text x={at.x} y={at.y + r + 14} textAnchor="middle" className="flow-name">{p.name}</text>}
      </g>; })}
    </svg>
    <figcaption><span className="legend-dot debtor" />Owes <span className="legend-dot" />Is owed · {session.transfers.length} {session.transfers.length === 1 ? "payment" : "payments"} instead of a tangle</figcaption>
  </figure>;
}
