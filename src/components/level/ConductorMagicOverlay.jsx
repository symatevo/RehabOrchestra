import { useGameStore } from "../../store/useGameStore.js";

function life01(ts, ms = 520) {
  if (!ts) return 0;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return Math.max(0, 1 - (now - ts) / ms);
}

function Trail({ leftPct, rotDeg, alpha, color }) {
  if (alpha <= 0) return null;
  return (
    <div
      className="absolute bottom-[18%] h-44 w-1.5 rounded-full blur-[1px]"
      style={{
        left: `${leftPct}%`,
        transform: `translateX(-50%) rotate(${rotDeg}deg)`,
        opacity: alpha,
        background: `linear-gradient(to top, transparent 0%, ${color} 45%, transparent 100%)`,
        boxShadow: `0 0 22px ${color}`,
      }}
    />
  );
}

/** Contextual magical guidance trails; strong on events, fades when idle. */
export function ConductorMagicOverlay() {
  const screen = useGameStore((s) => s.screen);
  const magic = useGameStore((s) => s.magicPulseAt);
  if (screen !== "playing") return null;

  const up = life01(magic.up, 640);
  const down = life01(magic.down, 560);
  const close = life01(magic.close, 420);
  const hitL = life01(magic.hitL, 480);
  const hitR = life01(magic.hitR, 480);
  const hitBoth = life01(magic.hitBoth, 520);
  const maxV = Math.max(up, down, close, hitL, hitR, hitBoth);
  if (maxV <= 0.01) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[42]">
      <Trail leftPct={20} rotDeg={-8} alpha={up * 0.8 + hitL * 0.95 + hitBoth * 0.6} color="rgba(34,211,238,0.95)" />
      <Trail leftPct={80} rotDeg={8} alpha={up * 0.8 + hitR * 0.95 + hitBoth * 0.6} color="rgba(34,211,238,0.95)" />
      <Trail leftPct={20} rotDeg={9} alpha={down * 0.65} color="rgba(167,139,250,0.9)" />
      <Trail leftPct={80} rotDeg={-9} alpha={down * 0.65} color="rgba(167,139,250,0.9)" />
      {close > 0 && (
        <>
          <div
            className="absolute left-1/2 bottom-[19%] h-20 w-20 rounded-full border border-fuchsia-200/90"
            style={{
              transform: "translateX(-50%)",
              opacity: close * 0.9,
              boxShadow: "0 0 26px rgba(244,114,182,0.95)",
            }}
          />
          <div
            className="absolute left-1/2 bottom-[19%] h-10 w-10 rounded-full bg-fuchsia-300/35 blur-sm"
            style={{ transform: "translateX(-50%)", opacity: close }}
          />
        </>
      )}
    </div>
  );
}
