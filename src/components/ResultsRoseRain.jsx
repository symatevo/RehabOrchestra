import { useMemo } from "react";

import { publicUrl } from "../utils/publicUrl.js";

const ROSE_COUNT = 42;

export function ResultsRoseRain() {
  const roses = useMemo(() => {
    const out = [];
    let s = 777;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < ROSE_COUNT; i++) {
      out.push({
        id: i,
        left: rnd() * 100,
        delay: rnd() * 0.85,
        dur: 2.4 + rnd() * 2.2,
        drift: (rnd() - 0.5) * 140,
        size: 30 + rnd() * 44,
        rot: rnd() * 720 - 360,
      });
    }
    return out;
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[71] overflow-hidden" aria-hidden>
      {roses.map((r) => (
        <img
          key={r.id}
          src={publicUrl("rose.png")}
          alt=""
          className="results-rose absolute opacity-90 will-change-transform"
          style={{
            left: `${r.left}%`,
            top: "-14vh",
            width: `${r.size}px`,
            height: "auto",
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
            ["--rose-drift"]: `${r.drift}px`,
            ["--rose-rot"]: `${r.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}
