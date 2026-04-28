import { useMemo } from "react";
import { useGameStore } from "../store/useGameStore.js";

const SPARKLE_BASE = 8;
const SPARKLE_BONUS = 10;

function SparkleField({ count, seed, intense }) {
  const items = useMemo(() => {
    const out = [];
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < count; i++) {
      out.push({
        id: i,
        left: rnd() * 100,
        top: rnd() * 100,
        delay: rnd() * 2.4,
        dur: 1.2 + rnd() * 1.6,
        scale: 0.35 + rnd() * 0.85,
      });
    }
    return out;
  }, [count, seed]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${
        intense ? "mix-blend-screen opacity-100" : "mix-blend-screen opacity-90"
      }`}
      aria-hidden
    >
      {items.map((p) => (
        <span
          key={p.id}
          className="session-progress-sparkle absolute rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.85)]"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${2.5 * p.scale}px`,
            height: `${2.5 * p.scale}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SessionProgressBar() {
  const hits = useGameStore((s) => s.hits);
  const chart = useGameStore((s) => s.chart);
  const sessionCueStreak = useGameStore((s) => s.sessionCueStreak);
  const fever = sessionCueStreak >= 6;

  const totalCues = chart.length;
  const movementFill =
    totalCues > 0 ? Math.min(100, Math.round((hits / totalCues) * 1000) / 10) : 0;

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-[max(0.95rem,env(safe-area-inset-top))] z-[56] w-[min(72vw,14rem)] sm:w-[min(64vw,15.5rem)] -translate-x-1/2 transition-transform duration-500 ease-out ${
        fever
          ? "session-progress--fever scale-[1.04] drop-shadow-[0_8px_18px_rgba(251,146,60,0.4)]"
          : "scale-100"
      }`}
      aria-hidden
    >
      <div className="relative overflow-hidden rounded-lg border border-white/25 bg-slate-900/35 px-1.5 py-1 shadow-md backdrop-blur-md">
        <div className="relative h-2.5 w-full overflow-hidden rounded-md bg-slate-950/70 ring-1 ring-white/10">
          <div
            className="session-progress-liquid absolute inset-y-0 left-0 rounded-md transition-[width] duration-300 ease-out"
            style={{ width: `${movementFill}%` }}
          />
          <SparkleField count={SPARKLE_BASE} seed={41} intense={false} />
          {fever && <SparkleField count={SPARKLE_BONUS} seed={902} intense />}
        </div>
      </div>
    </div>
  );
}
