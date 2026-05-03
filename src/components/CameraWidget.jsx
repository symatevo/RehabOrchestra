import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { useEffect, useRef, useState } from "react";
import {
  HAND_CONNECTIONS,
  Holistic,
  POSE_CONNECTIONS,
} from "@mediapipe/holistic";
import { orchestraToneEngine } from "../audio/orchestraToneEngine.js";
import { useGameStore } from "../store/useGameStore.js";
import { VRM_AVATAR_FILES } from "../data/avatars.js";
import { t } from "../i18n/strings.js";
import { computeWorkingFist } from "../utils/workingHandFist.js";
import { computeHandExpressionFromPose } from "../utils/handExpressionFromPose.js";

const LEVEL_BADGE = {
  level1: "L1",
  level2: "L2",
  level3: "L3",
  level4: "L4",
  level5: "L5",
};

export function CameraWidget() {
  const [start, setStart] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoElement = useRef(null);
  const drawCanvas = useRef(null);
  const setVideoElement = useGameStore((s) => s.setVideoElement);
  const screen = useGameStore((s) => s.screen);
  const cycleAvatar = useGameStore((s) => s.cycleAvatar);
  const cycleAvatarPrev = useGameStore((s) => s.cycleAvatarPrev);
  const cycleLevel = useGameStore((s) => s.cycleLevel);
  const levelId = useGameStore((s) => s.levelId);
  const avatarIndex = useGameStore((s) => s.avatarIndex);
  const avatarCount = VRM_AVATAR_FILES.length;
  const locale = useGameStore((s) => s.locale);
  const damagedSide = useGameStore((s) => s.damagedSide);
  const setGamePaused = useGameStore((s) => s.setGamePaused);
  const cameraResumeNonce = useGameStore((s) => s.cameraResumeNonce);

  useEffect(() => {
    if (damagedSide) setStart(true);
  }, [damagedSide]);

  useEffect(() => {
    if (!cameraResumeNonce || screen !== "playing") return;
    if (useGameStore.getState().gamePaused) return;
    setStart(true);
  }, [cameraResumeNonce, screen]);

  useEffect(() => {
    if (screen === "playing") setStart(true);
  }, [screen]);

  const cameraRef = useRef(null);
  const holisticRef = useRef(null);
  /** Smoothed expression; landmarks match selfie video (hands up → lower y → higher expression). */
  const expressionSmoothedRef = useRef(0.5);
  const prevExpressionRef = useRef(0.5);

  useEffect(() => {
    let mounted = true;
    let delayTimer = 0;
    let rafBoot1 = 0;
    let rafBoot2 = 0;

    const stopPipeline = () => {
      if (delayTimer) {
        window.clearTimeout(delayTimer);
        delayTimer = 0;
      }
      cancelAnimationFrame(rafBoot1);
      cancelAnimationFrame(rafBoot2);
      rafBoot1 = 0;
      rafBoot2 = 0;
      try {
        cameraRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        holisticRef.current?.close();
      } catch {
        /* ignore */
      }
      cameraRef.current = null;
      holisticRef.current = null;
      setVideoElement(null);
    };

    if (!start) {
      stopPipeline();
      return;
    }

    const el = videoElement.current;
    if (!el) return;

    if (screen === "setup" && !damagedSide) {
      stopPipeline();
      setCameraError("");
      return () => {
        mounted = false;
        stopPipeline();
      };
    }

    const scheduleBoot = () => {
      if (!mounted) return;
      setVideoElement(el);
      setCameraError("");
      rafBoot1 = requestAnimationFrame(() => {
        rafBoot2 = requestAnimationFrame(bootMediaPipe);
      });
    };

    const bootMediaPipe = () => {
      if (!mounted) return;

      const holistic = new Holistic({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
      });
      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        refineFaceLandmarks: false,
        enableFaceGeometry: false,
      });
      holisticRef.current = holistic;

      holistic.onResults((results) => {
        if (!mounted) return;
        if (
          useGameStore.getState().screen === "setup" &&
          useGameStore.getState().damagedSide &&
          !useGameStore.getState().lobbyCameraReady
        ) {
          useGameStore.getState().setLobbyCameraReady(true);
        }
        const v = videoElement.current;
        const c = drawCanvas.current;
        if (c && v?.videoWidth) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, c.width, c.height);
            if (results.poseLandmarks) {
              drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: "#7eb8da",
                lineWidth: 3,
              });
              drawLandmarks(ctx, results.poseLandmarks, {
                color: "#c9dff5",
                lineWidth: 1.5,
              });
            }
            if (results.leftHandLandmarks) {
              drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
                color: "#e07a8e",
                lineWidth: 4,
              });
            }
            if (results.rightHandLandmarks) {
              drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
                color: "#5ab89a",
                lineWidth: 4,
              });
            }
            ctx.restore();
          }
        }

        const ds = useGameStore.getState().damagedSide;
        if (ds) {
          const next = computeWorkingFist(results, ds);
          const prev = useGameStore.getState().workingFist;
          useGameStore.getState().setWorkingFist(next);
          if (next && !prev) {
            useGameStore.getState().pulseFist();
            useGameStore.getState().pulseFistFx();
            useGameStore.getState().pulseMagic("close");
          }
        }

        const scr = useGameStore.getState().screen;
        if (scr === "playing" && results.poseLandmarks) {
          const prev = expressionSmoothedRef.current;
          const { expression01, zoneIndex } = computeHandExpressionFromPose(
            results.poseLandmarks,
            prev,
            0.72
          );
          expressionSmoothedRef.current = expression01;
          const prevE = prevExpressionRef.current;
          const d = expression01 - prevE;
          if (Math.abs(d) > 0.03) {
            useGameStore.getState().pulseMagic(d > 0 ? "up" : "down");
          }
          prevExpressionRef.current = expression01;
          useGameStore.getState().setHandExpression01(expression01);
          useGameStore.getState().setHandZoneIndex(/** @type {0 | 1 | 2} */ (zoneIndex));
        } else if (scr !== "playing") {
          expressionSmoothedRef.current = 0.5;
          prevExpressionRef.current = 0.5;
        }

        useGameStore.getState().resultsCallback?.(results);
      });

      const camera = new Camera(el, {
        onFrame: async () => {
          if (!mounted) return;
          try {
            await holistic.send({ image: el });
          } catch {
            if (mounted) {
              setCameraError("MediaPipe frame error");
            }
          }
        },
        width: 640,
        height: 480,
      });
      camera.start().catch(() => {
        if (!mounted) return;
        setCameraError("Camera access failed");
        setStart(false);
      });
      cameraRef.current = camera;
    };


    /** After left/right: wait past VRMAvatar settle window before MediaPipe drives the rig. */
    const LOBBY_CAMERA_DELAY_MS = 1350;

    if (screen === "setup" && damagedSide) {
      delayTimer = window.setTimeout(scheduleBoot, LOBBY_CAMERA_DELAY_MS);
    } else {
      scheduleBoot();
    }

    return () => {
      mounted = false;
      stopPipeline();
    };
  }, [start, setVideoElement, screen, damagedSide]);

  const showPreview = start && screen !== "results";

  return (
    <>
      <div
        className={`fixed z-[1000] top-4 left-4 w-[min(320px,42vw)] aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-white/60 ${
          showPreview ? "" : "hidden"
        }`}
      >
        <canvas
          ref={drawCanvas}
          className="absolute z-10 w-full h-full bg-black/40 top-0 left-0"
          style={{ transform: "scaleX(-1)" }}
        />
        <video
          ref={videoElement}
          className="absolute z-0 w-full h-full top-0 left-0 object-cover"
          style={{ transform: "scaleX(-1)" }}
          autoPlay
          muted
          playsInline
        />
      </div>
      {cameraError && (
        <div className="fixed left-4 top-[calc(1rem+min(320px,42vw)*0.75+0.5rem)] z-[1002] rounded-md bg-red-600/90 px-3 py-1.5 text-xs text-white shadow">
          {cameraError}
        </div>
      )}

      {screen === "setup" && (
        <div className="fixed z-[1001] bottom-6 right-28 flex items-center gap-2">
          <button
            type="button"
            onClick={() => cycleLevel()}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-slate-800/85 text-white shadow-lg transition hover:bg-slate-700"
            aria-label="level"
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full border-t-[3px] border-r-[3px] border-red-500 opacity-95"
              aria-hidden
            />
            <span className="pointer-events-none absolute inset-[2px] rounded-full ring-2 ring-red-500/60 ring-inset" aria-hidden />
            <svg className="relative z-[1] h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.}
                d="M9 9l10.5-3v11.25M9 9v8.25M9 19a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM19.5 17.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <span className="pointer-events-none absolute -bottom-1 -right-1 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
              {LEVEL_BADGE[levelId] ?? "L1"}
            </span>
          </button>

          <div className="flex items-center gap-1 rounded-full border border-white/50 bg-slate-800/85 px-1.5 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => cycleAvatarPrev()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-slate-700"
              aria-label={t(locale, "characterPrev")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex flex-col items-center text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
              <span className="mt-0.5 text-[9px] tabular-nums opacity-80">
                {avatarIndex + 1}/{avatarCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => cycleAvatar()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-slate-700"
              aria-label={t(locale, "characterNext")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setStart((prev) => {
            const next = !prev;
            if (prev && !next && screen === "playing" && useGameStore.getState().sessionMusicLive) {
              setGamePaused(true);
              orchestraToneEngine.pauseGameTransport();
            }
            return next;
          });
        }}
        className="fixed z-[1001] bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg transition hover:bg-sky-500"
        aria-label="camera"
      >
        {!start ? (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        ) : (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
            />
          </svg>
        )}
      </button>
    </>
  );
}
