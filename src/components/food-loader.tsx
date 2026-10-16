import { useEffect, useState } from "react";

export const LOADER_ICONS = ["☕", "🍕", "🥐", "🧾", "✨"];
export const LOADER_COPY = [
  "Figuring out who had the extra slice...",
  "Dividing taxes and platform fees evenly...",
  "Running the math so nobody has an awkward chat...",
];
/** One full pass of the micro-copy; results wait for at least this long. */
export const LOADER_MIN_MS = LOADER_COPY.length * 800;

export function FoodLoader({ compact = false }: { compact?: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 800);
    return () => window.clearInterval(id);
  }, []);
  const active = tick % LOADER_ICONS.length;
  return <div className={compact ? "food-loader compact" : "food-loader"} role="status" aria-live="polite">
    <div className="food-icons" aria-hidden="true">{LOADER_ICONS.map((icon, i) => <span key={icon} className={i === active ? "is-active" : ""} style={{ animationDelay: `${i * 120}ms` }}>{icon}</span>)}</div>
    <p key={tick % LOADER_COPY.length} className="food-copy">{LOADER_COPY[tick % LOADER_COPY.length]}</p>
  </div>;
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
