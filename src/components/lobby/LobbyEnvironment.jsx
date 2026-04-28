/**
 * Lobby-only 3D scene ported from r3f-vrm-starter Experience.jsx (decor + lighting + bloom).
 * Avatar is passed as children and rendered before BackgroundImage to match the starter order.
 */
import { Environment, useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { SRGBColorSpace } from "three";
import { SkeletonUtils } from "three-stdlib";
import { Butterfly3D } from "../level/Butterfly3D.jsx";

const GRASS_URL = "models/Overall design/animated_grass.glb";
const BUSH_URL = "models/Overall design/simple_bush.glb";

function AnimatedGrass({ position, rotation, scale }) {
  const group = useRef();
  const { scene, animations } = useGLTF(GRASS_URL);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const firstAction = Object.values(actions)[0];
    if (firstAction) firstAction.play();
  }, [actions]);

  return (
    <primitive
      ref={group}
      object={clone}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

function AnimatedBush({ position, rotation, scale }) {
  const group = useRef();
  const { scene, animations } = useGLTF(BUSH_URL);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const firstAction = Object.values(actions)[1];
    if (firstAction) firstAction.play();
  }, [actions]);

  return (
    <primitive
      ref={group}
      object={clone}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

function StonePath() {
  const stones = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 0.4,
        z: -1.5 - i * 0.55,
        rotY: (Math.random() - 0.5) * 0.3,
        w: 0.7 + Math.random() * 0.2,
        d: 0.4 + Math.random() * 0.15,
      })),
    []
  );

  return (
    <group>
      {stones.map(({ id, x, z, rotY, w, d }) => (
        <mesh key={id} rotation={[-Math.PI / 2, rotY, 0]} position={[x, 0.02, z]}>
          <boxGeometry args={[w, d, 0.04]} />
          <meshStandardMaterial color="#715745" />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundImage() {
  const skyTexture = useTexture("models/Overall design/sky.png");
  const floorTexture = useTexture("models/Overall design/floor.png");
  const grassTexture = useTexture("models/Overall design/grass.png");

  useLayoutEffect(() => {
    floorTexture.colorSpace = SRGBColorSpace;
  }, [floorTexture]);

  return (
    <>
      <mesh position={[0, 6.2, -8]}>
        <planeGeometry args={[30, 12]} />
        <meshBasicMaterial map={skyTexture} depthWrite={false} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.1, 0, -1.2]}
        scale={[0.6, 1, 1]}
      >
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial map={floorTexture} toneMapped={false} />
      </mesh>
      {/* Grass strip — depthWrite off so 3D animated grass always renders on top */}
      <mesh position={[2.5, 0.18, -6.5]} rotation={[-0.18, 0, 0]} scale={0.3}>
        <planeGeometry args={[14, 1.4]} />
        <meshBasicMaterial map={grassTexture} transparent alphaTest={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[-3.5, 0.18, -6]} rotation={[-0.18, 0, 0]} scale={0.2}>
        <planeGeometry args={[14, 1.4]} />
        <meshBasicMaterial map={grassTexture} transparent alphaTest={0.1} depthWrite={false} />
      </mesh>
    </>
  );
}


function OrchestraChair({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.28, 0.04, 0.28]} />
        <meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.24, 0.04, 0.24]} />
        <meshStandardMaterial color="#8b2020" />
      </mesh>
      <mesh position={[0, 0.44, -0.13]}>
        <boxGeometry args={[0.26, 0.32, 0.03]} />
        <meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh position={[0, 0.44, -0.11]}>
        <boxGeometry args={[0.22, 0.26, 0.02]} />
        <meshStandardMaterial color="#8b2020" />
      </mesh>
      {[[-0.11, -0.11], [-0.11, 0.11], [0.11, -0.11], [0.11, 0.11]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.11, lz]}>
          <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          <meshStandardMaterial color="#3d2010" />
        </mesh>
      ))}
    </group>
  );
}

function MusicStand({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
        <meshStandardMaterial color="#888888" metalness={0.8} />
      </mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.05, 0.02, Math.sin(angle) * 0.05]}
          rotation={[0, -angle, 0.3]}
        >
          <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
          <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0.56, 0.04]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.28, 0.22, 0.01]} />
        <meshStandardMaterial color="#555555" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.565, 0.045]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.24, 0.18, 0.002]} />
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      <mesh position={[0, 0.455, 0.07]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.28, 0.02, 0.04]} />
        <meshStandardMaterial color="#555555" metalness={0.5} />
      </mesh>
    </group>
  );
}

/** @param {{ children?: import('react').ReactNode, hideChairs?: boolean }} props */
export function LobbyEnvironment({ children, hideChairs = false }) {
  return (
    <>
      <Environment preset="city" />
      <directionalLight intensity={2} position={[0, 5, -15]} color="#ffffff" castShadow />
      <directionalLight intensity={1} position={[0, 3, 5]} color="#d48d29" />
      <ambientLight intensity={0.3} color="#ffaa66" />

      <group position={[0, -1.27, 0]}>
      {children}
        <BackgroundImage />
        <>
          <mesh position={[0, 0.1, -11]} scale={[1.6, 0.5, 1]} receiveShadow castShadow>
            <cylinderGeometry args={[3.6, 3.6, 0.6, 64]} />
            <meshStandardMaterial color="#8b6b4f" />
          </mesh>
          <mesh position={[0, 0.34, -11]} scale={[1.6, 0.5, 1]} receiveShadow>
            <cylinderGeometry args={[3.3, 3.3, 0.05, 64]} />
            <meshStandardMaterial color="#d8b388" />
          </mesh>
        </>
        {
          <StonePath />
        }
       <AnimatedGrass position={[3, 0, -3]} scale={0.5} />
        <AnimatedGrass position={[-2.7, 0, -5]} scale={0.5} />
        <AnimatedGrass position={[3, 0, -3.5]} scale={0.5} />
        <AnimatedGrass position={[-1, 0, -6]} scale={0.5} />
        <AnimatedGrass position={[3.3, 0, -4.8]} scale={0.9} />
        <AnimatedGrass position={[-3.3, 0, -4.8]} scale={0.9} />
        <AnimatedGrass position={[-2, 0, -5]} scale={0.5} />
        <AnimatedGrass position={[-2.5, 0, -3]} scale={1} />
        <AnimatedGrass position={[2.6, 0, -3]} scale={1} />
        <AnimatedGrass position={[-1, 0, -2]} scale={0.7} />
        <AnimatedGrass position={[1.5, 0, -6]} scale={0.3} />
        <AnimatedGrass position={[-1, 0, -4.5]} scale={0.3} />
        <AnimatedGrass position={[-3.5, 0, -8]} scale={0.3} />
        <AnimatedGrass position={[-4.5, 0, -8.2]} scale={0.3} />
        <AnimatedGrass position={[-3.5, 0, -8]} scale={0.3} />
        <AnimatedGrass position={[-4.5, 0, -8.2]} scale={0.3} />
        <AnimatedGrass position={[3.5, 0, 4.8]} scale={0.3} />
        <AnimatedGrass position={[-3.5, 0, 4.2]} scale={0.3} />
        <AnimatedGrass position={[1, 0, -3]} scale={0.7} />
        <AnimatedGrass position={[1, 0, -1]} scale={0.7} />
        <AnimatedBush position={[3.5, 0, -4.8]} scale={3} />
        <AnimatedBush position={[-3.5, 0, -4.2]} scale={3.5} />
        <AnimatedBush position={[5.1, 0, -6.5]} scale={4} />


        <Butterfly3D mode="lobby" startPosition={[-2, 1.8, -4]} speed={0.3} radius={5} />
        <Butterfly3D mode="lobby" startPosition={[2.5, 2.2, -5]} speed={0.5} radius={0.9} />
        <Butterfly3D mode="lobby" startPosition={[-3, 0.5, -7]} speed={0.5} radius={0.33} />

        {/* <AnimatedGrass position={[3, 0, -3]} scale={0.5} />
        <AnimatedGrass position={[-2.7, 0, -5]} scale={0.5} />
        <AnimatedGrass position={[3, 0, -3.5]} scale={0.5} />
        <AnimatedGrass position={[-1, 0, -6]} scale={0.5} />
        <AnimatedGrass position={[3.3, 0, -4.8]} scale={0.9} />
        <AnimatedGrass position={[-2, 0, -5]} scale={0.5} />
        <AnimatedGrass position={[-2.5, 0, -3]} scale={1} />
        <AnimatedGrass position={[2.6, 0, -4]} scale={1} />
        <AnimatedGrass position={[-1, 0, -2]} scale={0.7} />
        <AnimatedGrass position={[1.5, 0, -6]} scale={0.3} />
        <AnimatedGrass position={[-1, 0, -4.5]} scale={0.3} />
        <AnimatedGrass position={[-3.5, 0, -8]} scale={0.3} />
        <AnimatedGrass position={[-4.5, 0, -8.2]} scale={0.3} />
        <AnimatedGrass position={[1, 0, -3]} scale={0.7} />
        <AnimatedBush position={[3.5, 0, -4.8]} scale={3} />
        <AnimatedBush position={[-3.5, 0, -4.2]} scale={3.5} />
        <AnimatedBush position={[5.1, 0, -6.5]} scale={4} /> */}
        {/* <StonePath /> */}
        {!hideChairs && (
          <>
            <OrchestraChair position={[4.6, 0.36, -9.9]} rotation={[0, -Math.PI / 4, 0]} />
            <OrchestraChair position={[3.6, 0.36, -10.2]} rotation={[0, -Math.PI / 8, 0]} />
            <OrchestraChair position={[2.4, 0.36, -10.5]} rotation={[0, -Math.PI / 10, 0]} />
            <OrchestraChair position={[1.2, 0.36, -10.7]} rotation={[0, 0, 0]} />
            <OrchestraChair position={[-4.6, 0.36, -9.9]} rotation={[0, Math.PI / 4, 0]} />
            <OrchestraChair position={[-3.6, 0.36, -10.2]} rotation={[0, Math.PI / 8, 0]} />
            <OrchestraChair position={[-2.4, 0.36, -10.5]} rotation={[0, Math.PI / 10, 0]} />
            <OrchestraChair position={[-1.2, 0.36, -10.7]} rotation={[0, 0, 0]} />
            <MusicStand position={[4, 0.5, -9]} rotation={[0, 2, 0]} />
            <MusicStand position={[3, 0.5, -9.2]} rotation={[0, 2.5, 0]} />
            <MusicStand position={[2, 0.5, -9.5]} rotation={[0, 2.7, 0]} />
            <MusicStand position={[1.2, 0.5, -9.7]} rotation={[0, 2.7, 0]} />
            <MusicStand position={[-4, 0.5, -9]} rotation={[0, -2, 0]} />
            <MusicStand position={[-3, 0.5, -9.2]} rotation={[0, -2.5, 0]} />
            <MusicStand position={[-2, 0.5, -9.5]} rotation={[0, -2.7, 0]} />
            <MusicStand position={[-1.2, 0.5, -9.7]} rotation={[0, -2.7, 0]} />
          </>
        )}
      </group>

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.9} levels={4} />
      </EffectComposer>
    </>
  );
}

useGLTF.preload(GRASS_URL);
useGLTF.preload(BUSH_URL);
