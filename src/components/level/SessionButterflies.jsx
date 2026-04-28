import { Butterfly3D } from "./Butterfly3D.jsx";
import { useGameStore } from "../../store/useGameStore.js";
import { SESSION_WIDE_SPARKLE_STREAK } from "./SessionWideSparkles.jsx";

/**
 * Three orbiting sparkle swarms (particles only), tuned for the narrow playing-camera FOV.
 * Correct cues and hold pulses bump `butterflySpinPulseAt` → bursts in Butterfly3D.
 */
export function SessionButterflies() {
  const spinPulseAt = useGameStore((s) => s.butterflySpinPulseAt);
  const sessionCueStreak = useGameStore((s) => s.sessionCueStreak);
  const shineBoost = sessionCueStreak >= 3;
  const burstStrength = sessionCueStreak >= SESSION_WIDE_SPARKLE_STREAK ? 0.22 : 0.5;

  return (
    <group position={[0, -0.25, -3]} scale={0.1}>
      <Butterfly3D
        startPosition={[-1.8, 0.9, -0.1]}
        speed={0.3}
        radius={2}
        spinPulseAt={spinPulseAt}
        shineBoost={shineBoost}
        burstStrength={burstStrength}
      />
      <Butterfly3D
        startPosition={[0.5, 0.24, -0.28]}
        speed={0.5}
        radius={1}
        spinPulseAt={spinPulseAt}
        shineBoost={shineBoost}
        burstStrength={burstStrength}
      />
      <Butterfly3D
        startPosition={[-0.9, 0.2, -0.42]}
        speed={0.5}
        radius={0.5}
        spinPulseAt={spinPulseAt}
        shineBoost={shineBoost}
        burstStrength={burstStrength}
      />
    </group>
  );
}
