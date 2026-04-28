import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import gsap from "gsap";
import { useGameStore } from "../../store/useGameStore.js";
import { orchestraToneEngine } from "../../audio/orchestraToneEngine.js";

function Player({ position, rotationY, color, pulseAt, phase = 0, expression01 = 0.5, emissive }) {
  const g = useRef(/** @type {Group | null} */ (null));
  const armRef = useRef(null);
  const bowRef = useRef(null);
  const bodyMat = useRef(null);
  const hairMat = useRef(null);
  const violinMat = useRef(null);
  useFrame(() => {
    const root = g.current;
    if (!root) return;
    const now = performance.now();
    const dt = (now - pulseAt) / 1000;
    const env = Math.max(0, 1 - dt * 1.8);
    const amp = 0.7 + expression01 * 1.35;
    const bow = Math.sin((now / 1000) * 16 + phase) * env * amp;
    root.rotation.z = bow * 0.055;
    root.position.y = position[1] + Math.abs(bow) * 0.03;
    if (armRef.current) armRef.current.rotation.x = 0.25 + bow * 0.09;
    if (bowRef.current) bowRef.current.rotation.z = -0.9 + bow * 0.2;
    const glow = Math.min(1.4, emissive * 0.7 + env * 0.45);
    if (bodyMat.current) {
      bodyMat.current.emissive.setRGB(glow * 0.05, glow * 0.1, glow * 0.16);
      bodyMat.current.emissiveIntensity = 0.25 + glow;
    }
    if (hairMat.current) {
      hairMat.current.emissive.setRGB(glow * 0.05, glow * 0.06, glow * 0.08);
      hairMat.current.emissiveIntensity = 0.2 + glow * 0.35;
    }
    if (violinMat.current) {
      violinMat.current.emissive.setRGB(glow * 0.15, glow * 0.09, glow * 0.04);
      violinMat.current.emissiveIntensity = 0.15 + glow * 0.4;
    }
  });

  return (
    <group ref={g} position={position} rotation={[0, rotationY, 0]}>
      {/* anime-ish hair */}
      <mesh position={[0, 0.53, -0.01]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.082, 16, 16]} />
        <meshStandardMaterial ref={hairMat} color="#151a29" roughness={0.3} metalness={0.15} />
      </mesh>
      {/* jacket */}
      <mesh position={[0, 0.24, 0]} scale={[1, 1.05, 0.86]}>
        <capsuleGeometry args={[0.09, 0.31, 6, 14]} />
        <meshStandardMaterial ref={bodyMat} color={color} roughness={0.48} metalness={0.08} />
      </mesh>
      {/* face */}
      <mesh position={[0, 0.46, 0]}>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshStandardMaterial color="#efd1b7" roughness={0.7} />
      </mesh>
      {/* violin arm */}
      <mesh ref={armRef} position={[0.036, 0.305, -0.015]} rotation={[0.25, 0.38, 0.32]}>
        <capsuleGeometry args={[0.024, 0.1, 4, 8]} />
        <meshStandardMaterial color="#223047" />
      </mesh>
      {/* violin */}
      <mesh position={[0.058, 0.292, -0.02]} rotation={[0.2, 0.6, 0.25]}>
        <boxGeometry args={[0.09, 0.03, 0.045]} />
        <meshStandardMaterial ref={violinMat} color="#7f4d1d" roughness={0.45} />
      </mesh>
      {/* bow */}
      <mesh ref={bowRef} position={[0.022, 0.305, -0.08]} rotation={[0, 0, -0.9]}>
        <boxGeometry args={[0.22, 0.008, 0.008]} />
        <meshStandardMaterial color="#d7c7ad" />
      </mesh>
    </group>
  );
}

/** Procedural back-facing orchestra placeholders for play mode */
export function OrchestraPlayers3D() {
  const pulses = useGameStore((s) => s.orchestraSectionPulseAt);
  const sideHitAt = useGameStore((s) => s.sideHitAt);
  const expression01 = useGameStore((s) => s.handExpression01);
  const sectionRefs = {
    left: useRef(/** @type {Group | null} */ (null)),
    center: useRef(/** @type {Group | null} */ (null)),
    right: useRef(/** @type {Group | null} */ (null)),
  };
  const maxPulse = Math.max(pulses.left, pulses.center, pulses.right);
  const pulseLife = Math.max(0, 1 - ((performance.now() - maxPulse) / 550));
  const ampRef = useRef(0);
  useFrame(() => {
    ampRef.current = orchestraToneEngine.getAmplitude();
  });

  useEffect(() => {
    const left = sectionRefs.left.current;
    if (!left) return;
    gsap.fromTo(left.scale, { y: 1 }, { y: 1.22, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" });
  }, [sideHitAt.left]);

  useEffect(() => {
    const right = sectionRefs.right.current;
    if (!right) return;
    gsap.fromTo(right.scale, { y: 1 }, { y: 1.22, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" });
  }, [sideHitAt.right]);
  const players = useMemo(
    () => [
      { pos: [-1.25, -1.18, -0.8], section: "left", color: "#2f3c52", yaw: 0.18, phase: 0.0 },
      { pos: [-0.95, -1.18, -0.92], section: "left", color: "#3a4961", yaw: 0.12, phase: 1.1 },
      { pos: [-0.58, -1.2, -0.98], section: "center", color: "#2f4652", yaw: 0.04, phase: 2.0 },
      { pos: [0.58, -1.2, -0.98], section: "center", color: "#2f4652", yaw: -0.04, phase: 2.8 },
      { pos: [0.95, -1.18, -0.92], section: "right", color: "#4b3f55", yaw: -0.12, phase: 3.6 },
      { pos: [1.25, -1.18, -0.8], section: "right", color: "#4b3f55", yaw: -0.18, phase: 4.4 },
    ],
    []
  );

  const pulseAt = (section) =>
    section === "left" ? pulses.left : section === "center" ? pulses.center : pulses.right;

  const pulseForSection = (section) => Math.max(0, 1 - ((performance.now() - pulseAt(section)) / 520));
  return (
    <group>
      {/* Slightly raised conductor podium */}
      <mesh position={[0, -1.29, -0.22]}>
        <boxGeometry args={[0.86, 0.1, 0.54]} />
        <meshStandardMaterial color="#7d2430" />
      </mesh>
      <mesh position={[0, -1.24, -0.08]}>
        <ringGeometry args={[0.45, 0.58, 46]} />
        <meshBasicMaterial color="#93c5fd" transparent opacity={0.12 + pulseLife * 0.25} />
      </mesh>
      {["left", "center", "right"].map((section) => (
        <group key={section} ref={sectionRefs[section]}>
          {players.filter((p) => p.section === section).map((p, i) => (
            <group key={`${p.section}-${i}`}>
              <mesh position={[p.pos[0], p.pos[1] - 0.08, p.pos[2] - 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.12, 0.2, 24]} />
                <meshBasicMaterial
                  color={p.section === "left" ? "#8be9ff" : p.section === "center" ? "#9effc7" : "#ffb6ef"}
                  transparent
                  opacity={0.08 + pulseForSection(p.section) * 0.38}
                />
              </mesh>
              <Player
                position={p.pos}
                rotationY={p.yaw}
                color={p.color}
                pulseAt={pulseAt(p.section)}
                phase={p.phase}
                expression01={expression01}
                emissive={ampRef.current}
              />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
