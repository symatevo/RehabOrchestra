import { Butterfly3D } from "./Butterfly3D.jsx";
import { useGameStore } from "../../store/useGameStore.js";

/** Extra streak tier: after 6 successful cues in a row, sparkles also burst from many screen positions. */
export const SESSION_WIDE_SPARKLE_STREAK = 6;

/** Eight world-space anchors across the narrow playing-camera view (not the three orbiting swarms). */
const WIDE_ANCHORS = /** @type {const} */ ([
  [-0.38, -0.72, -4.85],
  [0.32, -0.58, -5.35],
  [-0.14, -0.48, -4.35],
  [0.4, -0.86, -5.65],
  [-0.42, -0.88, -5.45],
  [0.08, -0.45, -4.55],
  [0.38, -0.68, -5.05],
  [-0.22, -0.62, -5.5],
]);

export function SessionWideSparkles() {
  const spinPulseAt = useGameStore((s) => s.butterflySpinPulseAt);
  const sessionCueStreak = useGameStore((s) => s.sessionCueStreak);
  const shineBoost = sessionCueStreak >= 3;
  const wide = sessionCueStreak >= SESSION_WIDE_SPARKLE_STREAK;
  if (!wide) return null;

  return (
    <group>
      {WIDE_ANCHORS.map((pos, i) => (
        <Butterfly3D
          key={i}
          startPosition={[pos[0], pos[1], pos[2]]}
          speed={0}
          radius={0}
          stationary
          spinPulseAt={spinPulseAt}
          shineBoost={shineBoost}
          burstStrength={0.85}
          sparkleSizeScale={0.18}
          sparkleSphereSegments={10}
        />
      ))}
    </group>
  );
}
