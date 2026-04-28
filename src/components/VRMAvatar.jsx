import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Hand, Pose } from "kalidokit";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Euler, Quaternion } from "three";
import { VRM_AVATAR_FILES } from "../data/avatars.js";
import { useGameStore } from "../store/useGameStore.js";
import { remapMixamoAnimationToVrm } from "../utils/remapMixamoAnimationToVrm.jsx";
import { publicUrl } from "../utils/publicUrl.js";

/** After play/results → lobby, resync spring simulation with the scene graph. */
const SPRING_SOAK_AFTER_LOBBY_RETURN = 100;

/** destructive mesh prep — must run once per drei's cached scene (never twice). */
const vrmPrepDoneForScene = new WeakMap();

const tmpEuler = new Euler();
const tmpQuat = new Quaternion();

/**
 * Same as starter `rotateBone` — bone by VRM humanoid name, Euler-like value, slerp factor, optional axis flip.
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {string} boneName
 * @param {{ x: number; y: number; z: number }} value
 * @param {number} slerpFactor
 * @param {{ x: number; y: number; z: number }} [flip]
 */
function rotateBone(
  vrm,
  boneName,
  value,
  slerpFactor,
  flip = { x: 1, y: 1, z: 1 }
) {
  const bone = vrm.humanoid.getNormalizedBoneNode(/** @type {*} */ (boneName));
  if (!bone) {
    return;
  }
  tmpEuler.set(value.x * flip.x, value.y * flip.y, value.z * flip.z);
  tmpQuat.setFromEuler(tmpEuler);
  bone.quaternion.slerp(tmpQuat, slerpFactor);
}

/**
 * Exact arm + hand driving from `r3f-vrm-starter` VRMAvatar (Holistic + Kalidokit + swapped hands).
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {any} pose
 * @param {any | null} rigL riggedLeftHand (from camera **right** in starter)
 * @param {any | null} rigR riggedRightHand (from camera **left** in starter)
 * @param {number} delta
 */
function applyStarterUpperBody(vrm, pose, rigL, rigR, delta) {
  if (!pose) return;
  const da = delta * 5;
  const dh = delta * 12;

  rotateBone(vrm, "leftUpperArm", pose.LeftUpperArm, da);
  rotateBone(vrm, "leftLowerArm", pose.LeftLowerArm, da);
  rotateBone(vrm, "rightUpperArm", pose.RightUpperArm, da);
  rotateBone(vrm, "rightLowerArm", pose.RightLowerArm, da);

  if (rigL) {
    rotateBone(
      vrm,
      "leftHand",
      {
        z: pose.LeftHand?.z ?? 0,
        y: rigL.LeftWrist.y,
        x: rigL.LeftWrist.x,
      },
      dh
    );
    rotateBone(vrm, "leftRingProximal", rigL.LeftRingProximal, dh);
    rotateBone(vrm, "leftRingIntermediate", rigL.LeftRingIntermediate, dh);
    rotateBone(vrm, "leftRingDistal", rigL.LeftRingDistal, dh);
    rotateBone(vrm, "leftIndexProximal", rigL.LeftIndexProximal, dh);
    rotateBone(vrm, "leftIndexIntermediate", rigL.LeftIndexIntermediate, dh);
    rotateBone(vrm, "leftIndexDistal", rigL.LeftIndexDistal, dh);
    rotateBone(vrm, "leftMiddleProximal", rigL.LeftMiddleProximal, dh);
    rotateBone(vrm, "leftMiddleIntermediate", rigL.LeftMiddleIntermediate, dh);
    rotateBone(vrm, "leftMiddleDistal", rigL.LeftMiddleDistal, dh);
    rotateBone(vrm, "leftThumbProximal", rigL.LeftThumbIntermediate, dh);
    rotateBone(vrm, "leftThumbMetacarpal", rigL.LeftThumbProximal, dh);
    rotateBone(vrm, "leftThumbDistal", rigL.LeftThumbDistal, dh);
    rotateBone(vrm, "leftLittleProximal", rigL.LeftLittleProximal, dh);
    rotateBone(vrm, "leftLittleIntermediate", rigL.LeftLittleIntermediate, dh);
    rotateBone(vrm, "leftLittleDistal", rigL.LeftLittleDistal, dh);
  }

  if (rigR) {
    rotateBone(
      vrm,
      "rightHand",
      {
        z: pose.RightHand?.z ?? 0,
        y: rigR.RightWrist.y,
        x: rigR.RightWrist.x,
      },
      dh
    );
    rotateBone(vrm, "rightRingProximal", rigR.RightRingProximal, dh);
    rotateBone(vrm, "rightRingIntermediate", rigR.RightRingIntermediate, dh);
    rotateBone(vrm, "rightRingDistal", rigR.RightRingDistal, dh);
    rotateBone(vrm, "rightIndexProximal", rigR.RightIndexProximal, dh);
    rotateBone(vrm, "rightIndexIntermediate", rigR.RightIndexIntermediate, dh);
    rotateBone(vrm, "rightIndexDistal", rigR.RightIndexDistal, dh);
    rotateBone(vrm, "rightMiddleProximal", rigR.RightMiddleProximal, dh);
    rotateBone(vrm, "rightMiddleIntermediate", rigR.RightMiddleIntermediate, dh);
    rotateBone(vrm, "rightMiddleDistal", rigR.RightMiddleDistal, dh);
    rotateBone(vrm, "rightThumbMetacarpal", rigR.RightThumbProximal, dh);
    rotateBone(vrm, "rightThumbProximal", rigR.RightThumbIntermediate, dh);
    rotateBone(vrm, "rightThumbDistal", rigR.RightThumbDistal, dh);
    rotateBone(vrm, "rightLittleProximal", rigR.RightLittleProximal, dh);
    rotateBone(vrm, "rightLittleIntermediate", rigR.RightLittleIntermediate, dh);
    rotateBone(vrm, "rightLittleDistal", rigR.RightLittleDistal, dh);
  }
}

/** @param {{ x: number; y: number; z: number }} e */
function mirrorEuler(e) {
  return { x: e.x, y: -e.y, z: -e.z };
}

/**
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {'left'|'right'} side
 */
function collectSideRest(vrm, side) {
  const names =
    side === "left"
      ? [
          "leftUpperArm",
          "leftLowerArm",
          "leftHand",
          "leftRingProximal",
          "leftRingIntermediate",
          "leftRingDistal",
          "leftIndexProximal",
          "leftIndexIntermediate",
          "leftIndexDistal",
          "leftMiddleProximal",
          "leftMiddleIntermediate",
          "leftMiddleDistal",
          "leftThumbProximal",
          "leftThumbMetacarpal",
          "leftThumbDistal",
          "leftLittleProximal",
          "leftLittleIntermediate",
          "leftLittleDistal",
        ]
      : [
          "rightUpperArm",
          "rightLowerArm",
          "rightHand",
          "rightRingProximal",
          "rightRingIntermediate",
          "rightRingDistal",
          "rightIndexProximal",
          "rightIndexIntermediate",
          "rightIndexDistal",
          "rightMiddleProximal",
          "rightMiddleIntermediate",
          "rightMiddleDistal",
          "rightThumbProximal",
          "rightThumbMetacarpal",
          "rightThumbDistal",
          "rightLittleProximal",
          "rightLittleIntermediate",
          "rightLittleDistal",
        ];
  /** @type {Record<string, Quaternion>} */
  const out = {};
  for (const n of names) {
    const b = vrm.humanoid.getNormalizedBoneNode(/** @type {*} */ (n));
    if (b) out[n] = b.quaternion.clone();
  }
  return out;
}

/** Right half of starter rig (healthy side when left limb is damaged). */
function applyStarterRightHalf(vrm, pose, rigR, delta) {
  if (!pose) return;
  const da = delta * 5;
  const dh = delta * 12;
  rotateBone(vrm, "rightUpperArm", pose.RightUpperArm, da);
  rotateBone(vrm, "rightLowerArm", pose.RightLowerArm, da);
  if (!rigR) return;
  rotateBone(
    vrm,
    "rightHand",
    {
      z: pose.RightHand?.z ?? 0,
      y: rigR.RightWrist.y,
      x: rigR.RightWrist.x,
    },
    dh
  );
  rotateBone(vrm, "rightRingProximal", rigR.RightRingProximal, dh);
  rotateBone(vrm, "rightRingIntermediate", rigR.RightRingIntermediate, dh);
  rotateBone(vrm, "rightRingDistal", rigR.RightRingDistal, dh);
  rotateBone(vrm, "rightIndexProximal", rigR.RightIndexProximal, dh);
  rotateBone(vrm, "rightIndexIntermediate", rigR.RightIndexIntermediate, dh);
  rotateBone(vrm, "rightIndexDistal", rigR.RightIndexDistal, dh);
  rotateBone(vrm, "rightMiddleProximal", rigR.RightMiddleProximal, dh);
  rotateBone(vrm, "rightMiddleIntermediate", rigR.RightMiddleIntermediate, dh);
  rotateBone(vrm, "rightMiddleDistal", rigR.RightMiddleDistal, dh);
  rotateBone(vrm, "rightThumbProximal", rigR.RightThumbIntermediate, dh);
  rotateBone(vrm, "rightThumbIntermediate", rigR.RightThumbIntermediate, dh);
  rotateBone(vrm, "rightThumbDistal", rigR.RightThumbDistal, dh);
  rotateBone(vrm, "rightLittleProximal", rigR.RightLittleProximal, dh);
  rotateBone(vrm, "rightLittleIntermediate", rigR.RightLittleIntermediate, dh);
  rotateBone(vrm, "rightLittleDistal", rigR.RightLittleDistal, dh);
}

/** Left half of starter rig (healthy side when right limb is damaged). */
function applyStarterLeftHalf(vrm, pose, rigL, delta) {
  if (!pose) return;
  const da = delta * 5;
  const dh = delta * 12;
  rotateBone(vrm, "leftUpperArm", pose.LeftUpperArm, da);
  rotateBone(vrm, "leftLowerArm", pose.LeftLowerArm, da);
  if (!rigL) return;
  rotateBone(
    vrm,
    "leftHand",
    {
      z: -(pose.LeftHand?.z ?? 0),
      y: rigL.LeftWrist.y,
      x: rigL.LeftWrist.x,
    },
    dh
  );
  rotateBone(vrm, "leftRingProximal", rigL.LeftRingProximal, dh);
  rotateBone(vrm, "leftRingIntermediate", rigL.LeftRingIntermediate, dh);
  rotateBone(vrm, "leftRingDistal", rigL.LeftRingDistal, dh);
  rotateBone(vrm, "leftIndexProximal", rigL.LeftIndexProximal, dh);
  rotateBone(vrm, "leftIndexIntermediate", rigL.LeftIndexIntermediate, dh);
  rotateBone(vrm, "leftIndexDistal", rigL.LeftIndexDistal, dh);
  rotateBone(vrm, "leftMiddleProximal", rigL.LeftMiddleProximal, dh);
  rotateBone(vrm, "leftMiddleIntermediate", rigL.LeftMiddleIntermediate, dh);
  rotateBone(vrm, "leftMiddleDistal", rigL.LeftMiddleDistal, dh);
  rotateBone(vrm, "leftThumbProximal", rigL.LeftThumbIntermediate, dh);
  rotateBone(vrm, "leftThumbIntermediate", rigL.LeftThumbIntermediate, dh);
  rotateBone(vrm, "leftThumbDistal", rigL.LeftThumbDistal, dh);
  rotateBone(vrm, "leftLittleProximal", rigL.LeftLittleProximal, dh);
  rotateBone(vrm, "leftLittleIntermediate", rigL.LeftLittleIntermediate, dh);
  rotateBone(vrm, "leftLittleDistal", rigL.LeftLittleDistal, dh);
}

/** Mirror starter’s *right* side solve onto left bones (same numbers as starter, flipped like before). */
function applyMirroredLeftFromRightSolve(vrm, pose, rigR, delta) {
  if (!pose || !rigR) return;
  console.log("applyMirroredLeftFromRightSolve");
  const da = delta * 5;
  const dh = delta * 12;
  rotateBone(vrm, "leftUpperArm", mirrorEuler(pose.RightUpperArm), da);
  rotateBone(vrm, "leftLowerArm", mirrorEuler(pose.RightLowerArm), da);

  rotateBone(
    vrm,
    "leftHand",
    {
      z: -(pose.RightHand?.z ?? 0),
      x: mirrorEuler(rigR.RightWrist).x,
      y: mirrorEuler(rigR.RightWrist).y,
    },
    dh
  );
  rotateBone(vrm, "leftRingProximal", mirrorEuler(rigR.RightRingProximal), dh);
  rotateBone(vrm, "leftRingIntermediate", mirrorEuler(rigR.RightRingIntermediate), dh);
  rotateBone(vrm, "leftRingDistal", mirrorEuler(rigR.RightRingDistal), dh);
  rotateBone(vrm, "leftIndexProximal", mirrorEuler(rigR.RightIndexProximal), dh);
  rotateBone(vrm, "leftIndexIntermediate", mirrorEuler(rigR.RightIndexIntermediate), dh);
  rotateBone(vrm, "leftIndexDistal", mirrorEuler(rigR.RightIndexDistal), dh);
  rotateBone(vrm, "leftMiddleProximal", mirrorEuler(rigR.RightMiddleProximal), dh);
  rotateBone(vrm, "leftMiddleIntermediate", mirrorEuler(rigR.RightMiddleIntermediate), dh);
  rotateBone(vrm, "leftMiddleDistal", mirrorEuler(rigR.RightMiddleDistal), dh);
  rotateBone(vrm, "leftThumbMetacarpal", mirrorEuler(rigR.RightThumbProximal), dh);
  rotateBone(vrm, "leftThumbProximal", mirrorEuler(rigR.RightThumbIntermediate), dh);
  rotateBone(vrm, "leftThumbDistal", mirrorEuler(rigR.RightThumbDistal), dh);
  rotateBone(vrm, "leftLittleProximal", mirrorEuler(rigR.RightLittleProximal), dh);
  rotateBone(vrm, "leftLittleIntermediate", mirrorEuler(rigR.RightLittleIntermediate), dh);
  rotateBone(vrm, "leftLittleDistal", mirrorEuler(rigR.RightLittleDistal), dh);
}

/** Mirror starter’s *left* side solve onto right bones. */
/**
 * Lobby-only: affected arm hangs at the side instead of bind-pose / T-pose.
 * Values are Euler radians tuned for typical VRM humanoid (Y-up, arms along X).
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {'left'|'right'} damagedSide
 * @param {number} delta
 */
function applyDamagedArmDownLobby(vrm, damagedSide, delta) {
  const k = delta * 5;
  // Empirically: Kalidokit + three-vrm normalized bones expect Z-dominant
  // rotation for an arm hanging along the torso. Sign mirrors between sides.
  if (damagedSide === "left") {
    rotateBone(vrm, "leftUpperArm", { x: 0, y: 0, z: 1.3 }, k);
    //rotateBone(vrm, "leftLowerArm", { x: 0, y: -3, z: 0.5 }, k);
    rotateBone(vrm, "leftLowerArm", { x: 0, y: -0.18, z: 0.05 }, k);
    rotateBone(vrm, "leftHand", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftThumbProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftThumbMetacarpal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftThumbDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftIndexProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftIndexIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftIndexDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftMiddleProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftMiddleIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftMiddleDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftRingProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftRingIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftRingDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftLittleProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftLittleIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "leftLittleDistal", { x: 0, y: 0, z: 0 }, k);
  } else {
    //rotateBone(vrm, "rightShoulder", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightUpperArm", { x: 0, y: 0, z: -1.3}, k);
    //rotateBone(vrm, "rightLowerArm", { x: 0, y: 3, z: -0.5 }, k);
    rotateBone(vrm, "rightLowerArm", { x: 0, y: 0.18, z: -0.05 }, k);
    rotateBone(vrm, "rightHand", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightThumbProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightThumbMetacarpal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightThumbDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightIndexProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightIndexIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightIndexDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightMiddleProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightMiddleIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightMiddleDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightRingProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightRingIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightRingDistal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightLittleProximal", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightLittleIntermediate", { x: 0, y: 0, z: 0 }, k);
    rotateBone(vrm, "rightLittleDistal", { x: 0, y: 0, z: 0 }, k);
  }
}

function applyMirroredRightFromLeftSolve(vrm, pose, rigL, delta) {
  if (!pose || !rigL) return;
  const da = delta * 5;
  const dh = delta * 12;
  rotateBone(vrm, "rightUpperArm", mirrorEuler(pose.LeftUpperArm), da);
  rotateBone(vrm, "rightLowerArm", mirrorEuler(pose.LeftLowerArm), da);
  rotateBone(
    vrm,
    "rightHand",
    {
      z: pose.LeftHand?.z ?? 0,
      x: mirrorEuler(rigL.LeftWrist).x,
      y: mirrorEuler(rigL.LeftWrist).y,
    },
    dh
  );
  rotateBone(vrm, "rightRingProximal", mirrorEuler(rigL.LeftRingProximal), dh);
  rotateBone(vrm, "rightRingIntermediate", mirrorEuler(rigL.LeftRingIntermediate), dh);
  rotateBone(vrm, "rightRingDistal", mirrorEuler(rigL.LeftRingDistal), dh);
  rotateBone(vrm, "rightIndexProximal", mirrorEuler(rigL.LeftIndexProximal), dh);
  rotateBone(vrm, "rightIndexIntermediate", mirrorEuler(rigL.LeftIndexIntermediate), dh);
  rotateBone(vrm, "rightIndexDistal", mirrorEuler(rigL.LeftIndexDistal), dh);
  rotateBone(vrm, "rightMiddleProximal", mirrorEuler(rigL.LeftMiddleProximal), dh);
  rotateBone(vrm, "rightMiddleIntermediate", mirrorEuler(rigL.LeftMiddleIntermediate), dh);
  rotateBone(vrm, "rightMiddleDistal", mirrorEuler(rigL.LeftMiddleDistal), dh);
  rotateBone(vrm, "rightThumbMetacarpal", mirrorEuler(rigL.LeftThumbProximal), dh);
  rotateBone(vrm, "rightThumbProximal", mirrorEuler(rigL.LeftThumbIntermediate), dh);
  rotateBone(vrm, "rightThumbDistal", mirrorEuler(rigL.LeftThumbDistal), dh);
  rotateBone(vrm, "rightLittleProximal", mirrorEuler(rigL.LeftLittleProximal), dh);
  rotateBone(vrm, "rightLittleIntermediate", mirrorEuler(rigL.LeftLittleIntermediate), dh);
  rotateBone(vrm, "rightLittleDistal", mirrorEuler(rigL.LeftLittleDistal), dh);
}

export function VRMAvatar({ avatar, ...props }) {
  const { scene, userData } = useGLTF(
    publicUrl(`models/${avatar}`),
    undefined,
    undefined,
    (loader) => {
      loader.register((parser) => new VRMLoaderPlugin(parser));
    }
  );

  const idleAsset = useFBX(publicUrl("models/animations/Breathing Idle.fbx"));
  const vrm = userData.vrm;

  const idleClip = useMemo(() => {
    if (!vrm) return null;
    const clip = remapMixamoAnimationToVrm(vrm, idleAsset);
    clip.name = "Idle";
    return clip;
  }, [idleAsset, vrm]);

  const { actions, mixer } = useAnimations(idleClip ? [idleClip] : [], vrm?.scene ?? scene);

  useEffect(() => {
    if (!vrm) return;
    const root = scene;
    if (vrmPrepDoneForScene.get(root)) {
      root.traverse((obj) => {
        obj.frustumCulled = false;
      });
      return;
    }
    VRMUtils.removeUnnecessaryVertices(scene);
    VRMUtils.combineSkeletons(scene);
    VRMUtils.combineMorphs(vrm);
    vrmPrepDoneForScene.set(root, true);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
    vrm.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const mat = object.material;
        if (mat.map) mat.map.anisotropy = 1;
        if (mat.normalMap) mat.normalMap.anisotropy = 1;
      }
    });
  }, [scene, vrm]);

  const setResultsCallback = useGameStore((s) => s.setResultsCallback);
  const videoElement = useGameStore((s) => s.videoElement);
  const damagedSide = useGameStore((s) => s.damagedSide);
  const mirrorUnlocked = useGameStore((s) => s.mirrorUnlocked);
  const screen = useGameStore((s) => s.screen);

  const riggedPose = useRef(null);
  const riggedLeftHand = useRef(null);
  const riggedRightHand = useRef(null);
  const restDamaged = useRef(/** @type {Record<string, Quaternion> | null} */ (null));
  /** Persist original spring manager while detached during play/results (small stage scale + pose breaks VRMSpringBone). */
  const springMgrRef = useRef(/** @type {any} */ (null));
  const pendingLobbySpringRef = useRef(false);
  const prevSetupRef = useRef(screen === "setup");

  useEffect(() => {
    if (!userData?.vrm?.springBoneManager || springMgrRef.current) return;
    springMgrRef.current = userData.vrm.springBoneManager;
  }, [userData?.vrm]);

  useLayoutEffect(() => {
    const setup = screen === "setup";
    if (!prevSetupRef.current && setup) pendingLobbySpringRef.current = true;
    prevSetupRef.current = setup;
  }, [screen]);

  useEffect(() => {
    if (!vrm) return;
    restDamaged.current = null;
  }, [vrm, damagedSide]);

  /** Same hand swap as starter (camera left → Right hand rig, camera right → Left hand rig). */
  const resultsCallback = useCallback(
    (results) => {
      const vid = useGameStore.getState().videoElement;
      if (!vid || !userData.vrm) return;
      if (results.za && results.poseLandmarks) {
        riggedPose.current = Pose.solve(results.za, results.poseLandmarks, {
          runtime: "mediapipe",
          video: vid,
        });
      }
      if (results.leftHandLandmarks) {
        riggedRightHand.current = Hand.solve(
          results.leftHandLandmarks,
          "Right"
        );
      }
      if (results.rightHandLandmarks) {
        riggedLeftHand.current = Hand.solve(results.rightHandLandmarks, "Left");
      }
    },
    [userData.vrm]
  );

  useEffect(() => {
    setResultsCallback(resultsCallback);
  }, [resultsCallback, setResultsCallback]);

  useEffect(() => {
    if (!videoElement && actions.Idle) {
      actions.Idle?.reset().fadeIn(0.4).play();
      return () => actions.Idle?.fadeOut(0.2).stop();
    }
    if (videoElement) {
      actions.Idle?.fadeOut(0.2).stop();
    }
  }, [videoElement, actions]);

  useFrame((_, delta) => {
    const v = userData.vrm;
    const inLobby = screen === "setup";

    if (!springMgrRef.current && v?.springBoneManager) {
      springMgrRef.current = v.springBoneManager;
    }

    /** One-shot stab after returning to lobby “Play again” */
    if (pendingLobbySpringRef.current && v?.springBoneManager && springMgrRef.current) {
      pendingLobbySpringRef.current = false;
      v.springBoneManager = springMgrRef.current;
      v.scene.updateMatrixWorld(true);
      v.springBoneManager.setInitState();
      const h = 1 / 60;
      for (let i = 0; i < SPRING_SOAK_AFTER_LOBBY_RETURN; i += 1) {
        mixer?.update(h);
        v.update(h);
      }
      return;
    }

    /** Game + results stage: disable springBone simulation (cloth/hair floats otherwise at ~0.36 scale). */
    if (v && springMgrRef.current) {
      v.springBoneManager = inLobby ? springMgrRef.current : null;
    }

    if (!v?.humanoid) return;

    const pose = riggedPose.current;
    if (!pose) {
      if (damagedSide && screen === "setup") {
        applyDamagedArmDownLobby(v, damagedSide, delta);
      }
      v.update(delta);
      return;
    }

    const rigL = riggedLeftHand.current;
    const rigR = riggedRightHand.current;

    if (!damagedSide) {
      applyStarterUpperBody(v, pose, rigL, rigR, delta);
      v.update(delta);
      return;
    }

    const damaged = damagedSide;
    if (!restDamaged.current) {
      restDamaged.current = collectSideRest(v, damaged);
    }

    const slerpToRest = (side) => {
      const rest = restDamaged.current;
      if (!rest) return;
      for (const [name, q] of Object.entries(rest)) {
        const bone = v.humanoid.getNormalizedBoneNode(/** @type {*} */ (name));
        if (!bone || !name.includes(side)) continue;
        bone.quaternion.slerp(q, delta * 6);
      }
    };

    if (damaged === "left") {
      applyStarterRightHalf(v, pose, rigR, delta);
      if (mirrorUnlocked) {
        applyMirroredLeftFromRightSolve(v, pose, rigR, delta);
      } else if (screen === "setup") {
        applyDamagedArmDownLobby(v, "left", delta);
      } else {
        slerpToRest("left");
      }
    } else {
      applyStarterLeftHalf(v, pose, rigL, delta);
      if (mirrorUnlocked) {
        applyMirroredRightFromLeftSolve(v, pose, rigL, delta);
      } else if (screen === "setup") {
        applyDamagedArmDownLobby(v, "right", delta);
      } else {
        slerpToRest("right");
      }
    }

    v.update(delta);
  });

  //const scaleX = screen === "playing" ? -1 : 1;

  return (
    <group {...props}>
      <primitive object={scene} rotation-y={Math.PI} />
    </group>
  );
}

for (const file of VRM_AVATAR_FILES) {
  useGLTF.preload(publicUrl(`models/${file}`), undefined, undefined, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
}
useFBX.preload(publicUrl("models/animations/Breathing Idle.fbx"));
