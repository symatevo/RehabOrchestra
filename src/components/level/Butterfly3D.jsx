import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

/**
 * @typedef {'lobby' | 'session'} ButterflyMode
 */

/**
 * Lobby: full butterfly mesh + sparkles. Session: sparkles only (hits/holds pulse bursts).
 * @param {{
 *   startPosition: [number, number, number];
 *   speed?: number;
 *   radius?: number;
 *   spinPulseAt?: number;
 *   shineBoost?: boolean;
 *   stationary?: boolean;
 *   burstStrength?: number;
 *   mode?: ButterflyMode;
 *   sparkleSizeScale?: number;
 *   sparkleSphereSegments?: number;
 * }} props
 */
export function Butterfly3D({
  startPosition,
  speed = 0.4,
  radius = 1.5,
  spinPulseAt = 0,
  shineBoost = false,
  stationary = false,
  burstStrength = 1,
  mode = "session",
  sparkleSizeScale = 1,
  sparkleSphereSegments = 4,
}) {
  const isLobby = mode === "lobby";
  const groupRef = useRef(/** @type {import('three').Group | null} */ (null));
  const wing1Ref = useRef(/** @type {import('three').Mesh | null} */ (null));
  const wing2Ref = useRef(/** @type {import('three').Mesh | null} */ (null));
  const t = useRef(Math.random() * Math.PI * 2);
  const lastHitPulseRef = useRef(0);

  const PARTICLE_COUNT = isLobby ? 12 : stationary ? 22 : 32;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      ref: /** @type {React.MutableRefObject<import('three').Mesh | null>} */ ({ current: null }),
      life: 0,
      maxLife: 0.8 + Math.random() * 0.4,
      x: 0,
      y: 0,
      z: 0,
      vx: (Math.random() - 0.5) * 0.01,
      vy: Math.random() * 0.02,
      vz: (Math.random() - 0.5) * 0.01,
    }))
  );
  const spawnTimer = useRef(0);

  function spawnBurst(cx, cy, cz, strength = 1) {
    if (isLobby) return;
    const base = 10 + 6 * strength;
    const n = Math.max(4, Math.floor(base * burstStrength));
    let spawned = 0;
    const velMul = 0.65 + 0.35 * sparkleSizeScale;
    for (const p of particles.current) {
      if (spawned >= n) break;
      if (p.life > 0) continue;
      p.life = (0.55 + Math.random() * 0.35) * (shineBoost ? 1.15 : 1);
      p.maxLife = p.life;
      p.x = cx + (Math.random() - 0.5) * 0.04;
      p.y = cy + (Math.random() - 0.5) * 0.04;
      p.z = cz + (Math.random() - 0.5) * 0.04;
      const s = (0.018 + Math.random() * 0.028) * Math.min(1.35, burstStrength) * velMul;
      p.vx = (Math.random() - 0.5) * s;
      p.vy = 0.012 + Math.random() * 0.04;
      p.vz = (Math.random() - 0.5) * s;
      spawned += 1;
    }
  }

  useFrame((_, delta) => {
    if (!isLobby && spinPulseAt === 0) lastHitPulseRef.current = 0;

    if (!stationary) t.current += delta * speed;

    const baseSpawn = (stationary ? 1.15 : 1.5) / Math.min(1.4, Math.max(0.5, burstStrength));
    const spawnInterval = shineBoost ? baseSpawn * 0.72 : baseSpawn;
    const pEmissive = shineBoost ? 3.25 : 2;
    const particleScaleMul = (shineBoost ? 1.22 : 1) * sparkleSizeScale;

    let newX = startPosition[0];
    let newY = startPosition[1];
    let newZ = startPosition[2];

    if (groupRef.current) {
      if (stationary) {
        newX = startPosition[0];
        newY = startPosition[1];
        newZ = startPosition[2];
      } else {
        newX = startPosition[0] + Math.sin(t.current) * radius;
        newY = startPosition[1] + Math.sin(t.current * 2) * 0.3;
        newZ = startPosition[2] + Math.cos(t.current) * radius * 0.5;
      }

      groupRef.current.position.set(newX, newY, newZ);

      if (isLobby) {
        groupRef.current.rotation.y = -t.current + Math.PI / 2;
      }

      if (!isLobby && spinPulseAt > lastHitPulseRef.current) {
        lastHitPulseRef.current = spinPulseAt;
        const hitMul = shineBoost ? 1.25 : 1;
        spawnBurst(newX, newY, newZ, hitMul);
      }

      const spawnEveryLobby = shineBoost ? 0.72 : 1.5;
      const effectiveInterval = isLobby ? spawnEveryLobby : spawnInterval;

      spawnTimer.current += delta;
      if (spawnTimer.current > effectiveInterval) {
        spawnTimer.current = 0;
        const dead = particles.current.find((p) => p.life <= 0);
        if (dead) {
          dead.life = dead.maxLife;
          dead.x = newX + (Math.random() - 0.5) * 0.05;
          dead.y = newY + (Math.random() - 0.5) * 0.05;
          dead.z = newZ + (Math.random() - 0.5) * 0.05;
          dead.vx = (Math.random() - 0.5) * 0.015;
          dead.vy = 0.01 + Math.random() * 0.02;
          dead.vz = (Math.random() - 0.5) * 0.015;
        }
      }
    }

    const wingEmissive = shineBoost ? 0.72 : 0.4;
    const flapAngle = Math.abs(Math.sin(t.current * 8)) * 0.6;
    if (isLobby) {
      if (wing1Ref.current) wing1Ref.current.rotation.y = -flapAngle;
      if (wing2Ref.current) wing2Ref.current.rotation.y = flapAngle;
      if (wing1Ref.current?.material && "emissiveIntensity" in wing1Ref.current.material) {
        wing1Ref.current.material.emissiveIntensity = wingEmissive;
      }
      if (wing2Ref.current?.material && "emissiveIntensity" in wing2Ref.current.material) {
        wing2Ref.current.material.emissiveIntensity = wingEmissive;
      }
    }

    particles.current.forEach((p) => {
      if (p.life <= 0) {
        if (p.ref.current) p.ref.current.visible = false;
        return;
      }
      p.life -= delta;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      if (p.ref.current) {
        p.ref.current.visible = true;
        p.ref.current.position.set(p.x, p.y, p.z);
        const lifeRatio = p.life / p.maxLife;
        const opBase = shineBoost ? 0.88 : 0.7;
        p.ref.current.material.opacity = lifeRatio * opBase;
        const s = lifeRatio * 0.03 * particleScaleMul;
        p.ref.current.scale.set(s, s, s);
        p.ref.current.material.emissiveIntensity = pEmissive * (0.75 + 0.25 * lifeRatio);
      }
    });
  });

  const pEmissiveStatic = shineBoost ? 3.25 : 2;
  const wingEmissiveStatic = shineBoost ? 0.72 : 0.4;

  return (
    <>
      {particles.current.map((p, i) => (
        <mesh key={i} ref={p.ref} visible={false}>
          <sphereGeometry args={[1, sparkleSphereSegments, sparkleSphereSegments]} />
          <meshStandardMaterial
            color="#ffffaa"
            emissive="#ffdd44"
            emissiveIntensity={pEmissiveStatic}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      <group ref={groupRef} position={startPosition}>
        {isLobby ? (
          <>
            <mesh ref={wing1Ref} position={[0, 0, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([0, 0, 0, -0.18, 0.08, 0, -0.1, -0.1, 0])}
                  itemSize={3}
                />
              </bufferGeometry>
              <meshStandardMaterial
                color="#fffaf0"
                emissive="#ffeeaa"
                emissiveIntensity={wingEmissiveStatic}
                transparent
                opacity={0.85}
                side={2}
              />
            </mesh>
            <mesh ref={wing2Ref} position={[0, 0, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([0, 0, 0, 0.18, 0.08, 0, 0.1, -0.1, 0])}
                  itemSize={3}
                />
              </bufferGeometry>
              <meshStandardMaterial
                color="#fffaf0"
                emissive="#ffeeaa"
                emissiveIntensity={wingEmissiveStatic}
                transparent
                opacity={0.85}
                side={2}
              />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.1, 4]} />
              <meshStandardMaterial color="#ccaa88" />
            </mesh>
          </>
        ) : null}
      </group>
    </>
  );
}
