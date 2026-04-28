import { Loader, Sparkles, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { useGameStore } from "../store/useGameStore.js";
import { publicUrl } from "../utils/publicUrl.js";
import { LobbyEnvironment } from "./lobby/LobbyEnvironment.jsx";
import { SessionButterflies } from "./level/SessionButterflies.jsx";
import { SessionWideSparkles } from "./level/SessionWideSparkles.jsx";
import { VRMAvatar } from "./VRMAvatar.jsx";

const PARTICLE_COUNT = 180;
const PLAYING_CAMERA = {
  position: [0, 0, 0],
  lookAt: [0, 0, 0],
  fov: 10,
};
const PLAYING_STAGE = {
  backdropPos: [0, -1, -12.4],
  backdropSize: [5, 1.9],
  floorPos: [0, -1.9, -10.45],
  floorSize: [26, 20],
  lipPos: [0, -1.22, -2.2],
  lipSize: [24, 0.08, 0.28],
};

const CONDUCTOR = {
  groupPos: [0, -1, -4.5],
  avatarPos: [0, 0.23, 0],
  avatarScale: [0.36, 0.36, 0.36],
};

/** Same as `LobbyEnvironment` inner group — avatar world anchor in lobby. */
const LOBBY_AVATAR_ROOT = [0, -1.27, 0];
const LOBBY_CAMERA_POS = [0, 0.5, 2.3];
const LOBBY_CAMERA_FOV = 30;

/** Visible pool of light from above onto the conductor (directionals alone have no “beam”). */
function ConductorSpotFromAbove() {
  const ref = useRef(/** @type {import('three').SpotLight | null} */ (null));
  const { scene } = useThree();

  useLayoutEffect(() => {
    const L = ref.current;
    if (!L) return;
    L.target.position.set(
      CONDUCTOR.groupPos[0],
      CONDUCTOR.groupPos[1] + 0.22,
      CONDUCTOR.groupPos[2]
    );
    scene.add(L.target);
    return () => {
      scene.remove(L.target);
    };
  }, [scene]);

  return (
    <spotLight
      ref={ref}
      position={[0, 9.8, -1.1]}
      angle={0.38}
      penumbra={0.9}
      intensity={42}
      distance={48}
      decay={2}
      color="#fffdf7"
    />
  );
}

/** Soft, blurry points low on the sky plane (in front of the backdrop image). */
function PlayingSkySoftStars() {
  return (
    <group position={[0, 0, 0]}>
      <Sparkles
        position={[0, -0.55, -12.36]}
        color={["#e4ecff", "#cfdfff", "#fff5eb"]}
        count={40}
        scale={[14, 2.4, 0.45]}
        size={7}
        speed={0.012}
        opacity={0.14}
        noise={4}
      />
      <Sparkles
        position={[0, -0.2, -12.35]}
        color={["#ffffff", "#dde8ff"]}
        count={22}
        scale={[11, 1.5, 0.35]}
        size={5}
        speed={0.008}
        opacity={0.09}
        noise={2.5}
      />
    </group>
  );
}

function NoteBurstParticles() {
  const noteBurstAt = useGameStore((s) => s.noteBurstAt);
  const burstRef = useRef({ left: 0, right: 0, both: 0 });

  const { geometry, posArr, sizeArr, particles } = useMemo(() => {
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const sizeArr = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      posArr[i * 3] = 999;
      posArr[i * 3 + 1] = 999;
      posArr[i * 3 + 2] = 999;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(posArr, 3));
    geometry.setAttribute("size", new BufferAttribute(sizeArr, 1));
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      alive: false,
      life: 0,
      ttl: 0.5,
      pos: new Vector3(),
      vel: new Vector3(),
      target: new Vector3(),
    }));
    return { geometry, posArr, sizeArr, particles };
  }, []);

  const spawnBurst = (side) => {
    const source =
      side === "left"
        ? new Vector3(-0.95, -0.2, 0.35)
        : side === "right"
          ? new Vector3(0.95, -0.2, 0.35)
          : new Vector3(0, -0.18, 0.35);
    const target =
      side === "left"
        ? new Vector3(-0.28, 0.02, 0.38)
        : side === "right"
          ? new Vector3(0.28, 0.02, 0.38)
          : new Vector3(0, 0.08, 0.38);
    let spawned = 0;
    for (const p of particles) {
      if (p.alive) continue;
      p.alive = true;
      p.life = 0;
      p.ttl = 0.5 + Math.random() * 0.08;
      p.pos.copy(source);
      p.target.copy(target);
      p.vel.set((Math.random() - 0.5) * 1.3, Math.random() * 1.2, (Math.random() - 0.5) * 1.3);
      spawned += 1;
      if (spawned >= 20) break;
    }
  };

  useFrame((_, delta) => {
    if (
      noteBurstAt.left !== burstRef.current.left ||
      noteBurstAt.right !== burstRef.current.right ||
      noteBurstAt.both !== burstRef.current.both
    ) {
      if (noteBurstAt.left !== burstRef.current.left) spawnBurst("left");
      if (noteBurstAt.right !== burstRef.current.right) spawnBurst("right");
      if (noteBurstAt.both !== burstRef.current.both) spawnBurst("both");
      burstRef.current = noteBurstAt;
    }
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const idx = i * 3;
      if (!p.alive) {
        posArr[idx] = 999;
        posArr[idx + 1] = 999;
        posArr[idx + 2] = 999;
        sizeArr[i] = 0;
        continue;
      }
      p.life += delta;
      const t = Math.min(1, p.life / p.ttl);
      p.pos.addScaledVector(p.vel, delta);
      p.pos.lerp(p.target, 0.14 + t * 0.24);
      p.vel.multiplyScalar(0.93);
      sizeArr[i] = Math.max(0, 1 - t);
      posArr[idx] = p.pos.x;
      posArr[idx + 1] = p.pos.y;
      posArr[idx + 2] = p.pos.z;
      if (t >= 1) p.alive = false;
    }
    const posAttr = geometry.getAttribute("position");
    if (posAttr) posAttr.needsUpdate = true;
    const sizeAttr = geometry.getAttribute("size");
    if (sizeAttr) sizeAttr.needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#a5f3fc"
        size={0.06}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function ConductorPodium() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 40]} />
        <meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.03, 40]} />
        <meshStandardMaterial color="#8b2020" />
      </mesh>
    </group>
  );
}

function PlayingSkyBackdrop() {
  const skyUrl = useMemo(() => publicUrl("game-sky.png"), []);
  const tex = useTexture(skyUrl);
  tex.colorSpace = SRGBColorSpace;

  return (
    <mesh position={PLAYING_STAGE.backdropPos}>
      <planeGeometry args={PLAYING_STAGE.backdropSize} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function PlayingStageEnvironment() {
  return (
    <group>
      <Suspense fallback={null}>
        <PlayingSkyBackdrop />
      </Suspense>
      <PlayingSkySoftStars />

      {/* Stage floor filling almost entire frame */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={PLAYING_STAGE.floorPos} receiveShadow>
        <planeGeometry args={PLAYING_STAGE.floorSize} />
        <meshStandardMaterial color="#f2e2c4" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Front lip to read like a stage edge */}
      <mesh position={PLAYING_STAGE.lipPos} receiveShadow>
        <boxGeometry args={PLAYING_STAGE.lipSize} />
        <meshStandardMaterial color="#cda477" />
      </mesh>
    </group>
  );
}

function LobbyCameraRig() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(LOBBY_CAMERA_POS[0], LOBBY_CAMERA_POS[1], LOBBY_CAMERA_POS[2]);
    camera.fov = LOBBY_CAMERA_FOV;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function PlayingCameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    const [px, py, pz] = PLAYING_CAMERA.position;
    const [lx, ly, lz] = PLAYING_CAMERA.lookAt;
    camera.position.set(px, py, pz);
    camera.fov = PLAYING_CAMERA.fov;
    const eye = new Vector3(px, py, pz);
    const target = new Vector3(lx, ly, lz);
    if (eye.distanceToSquared(target) < 1e-8) {
      target.set(0, -0.92, -10.4);
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Scene() {
  const avatar = useGameStore((s) => s.avatarFile);
  const screen = useGameStore((s) => s.screen);
  const isSetup = screen === "setup";
  const isPlaying = screen === "playing";
  const goalReady = useGameStore((s) => s.performanceGoalReached);
  const bloomPulseAt = useGameStore((s) => s.bloomPulseAt);
  const bloomLightRef = useRef(null);
  const bloomLightRefR = useRef(null);
  useFrame(() => {
    if (!bloomLightRef.current || !bloomLightRefR.current) return;
    const life = Math.max(0, 1 - ((performance.now() - bloomPulseAt) / 360));
    const fever = goalReady ? 1 : 0;
    bloomLightRef.current.intensity = isPlaying ? life * 2.4 : 0;
    bloomLightRefR.current.intensity = isPlaying ? life * 2.1 : 0;
    bloomLightRef.current.color.setStyle(fever ? "#f0abfc" : "#67e8f9");
    bloomLightRefR.current.color.setStyle(fever ? "#f9a8d4" : "#c4b5fd");
  });

  return (
    <>
      <color attach="background" args={isPlaying ? ["#152238"] : ["#1a1a2e"]} />
      {isSetup && <fog attach="fog" args={["#1a1a2e", 10, 20]} />}
      {isSetup && <LobbyCameraRig />}
      {!isSetup && <PlayingCameraRig />}
      {isSetup ? (
        <LobbyEnvironment />
      ) : (
        <>
          <PlayingStageEnvironment />
          <ambientLight intensity={0.58} color="#f0e8ff" />
          {/* Warm fill from audience / front */}
          <directionalLight position={[0, 5, -7]} intensity={1.05} color="#ffe8cf" castShadow />
          <directionalLight position={[-3, 2.5, -8]} intensity={0.4} color="#f7d7b5" />
          {/* Cool fill from above (no visible cone); use spot for the actual “light from up” on conductor */}
          <directionalLight position={[0, 14, -4]} intensity={0.55} color="#e8f2ff" />
          <hemisphereLight args={["#8cb4e8", "#4a3520", 0.35]} />
          <ConductorSpotFromAbove />
          <group position={CONDUCTOR.groupPos}>
            <ConductorPodium />
          </group>
          <SessionButterflies />
          <SessionWideSparkles />
        </>
      )}
      <group position={isSetup ? LOBBY_AVATAR_ROOT : CONDUCTOR.groupPos}>
        <group
          position={isSetup ? [0, 0, 0] : CONDUCTOR.avatarPos}
          scale={isSetup ? [1, 1, 1] : CONDUCTOR.avatarScale}
        >
          <VRMAvatar key={avatar} avatar={avatar} />
        </group>
      </group>
      {isPlaying && (
        <>
          <pointLight ref={bloomLightRef} position={[-2.2, -0.5, -9.6]} distance={6.5} intensity={0} color="#67e8f9" />
          <pointLight ref={bloomLightRefR} position={[2.2, -0.5, -9.6]} distance={6.5} intensity={0} color="#c4b5fd" />
          <NoteBurstParticles />
        </>
      )}
    </>
  );
}

export function GameScene() {
  const screen = useGameStore((s) => s.screen);
  const isSetup = screen === "setup";
  const isPlaying = screen === "playing";

  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        shadows={isSetup || isPlaying}
        camera={{ position: LOBBY_CAMERA_POS, fov: LOBBY_CAMERA_FOV }}
        gl={{ alpha: false, antialias: false, powerPreference: "default" }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <Loader />
    </div>
  );
}
