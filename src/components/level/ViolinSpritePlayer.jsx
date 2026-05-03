import { useEffect, useLayoutEffect, useRef } from "react";
import { useGameStore } from "../../store/useGameStore.js";
import { publicUrl } from "../../utils/publicUrl.js";
import { useOrchestraSpriteShrinkMul } from "./useOrchestraSpriteShrinkMul.js";

const PLAYER_VARIANTS = {
  viola1: {
    idle:   { url: publicUrl("models/Orchestra/viola1-normal-sprite/spritesheet.png"), frameW: 292, frameH: 482, cols: 2, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/viola1-normal-sprite/spritesheet.png"), frameW: 292, frameH: 482, cols: 2, rows: 2, frames: 4 },
  },
  viola2: {
    idle:   { url: publicUrl("models/Orchestra/viola2-normal-sprite/spritesheet.png"), frameW: 299, frameH: 489, cols: 4, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/viola2-normal-sprite/spritesheet.png"), frameW: 299, frameH: 489, cols: 4, rows: 2, frames: 8 },
  },
  viola3: {
    idle:   { url: publicUrl("models/Orchestra/viola3-normal-sprite/spritesheet.png"), frameW: 311, frameH: 509, cols: 2, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/viola3-normal-sprite/spritesheet.png"), frameW: 311, frameH: 509, cols: 2, rows: 2, frames: 4 },
  },
  viola4: {
    idle:   { url: publicUrl("models/Orchestra/viola4-normal-sprite/spritesheet.png"), frameW: 325, frameH: 484, cols: 4, rows: 1, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/viola4-normal-sprite/spritesheet.png"), frameW: 325, frameH: 484, cols: 4, rows: 1, frames: 4 },
  },
};

const VIOLISTS = ["viola1", "viola2", "viola3", "viola4"];

(function preloadAllSprites() {
  if (typeof window === "undefined") return;
  const seen = new Set();
  for (const player of Object.values(PLAYER_VARIANTS)) {
    for (const sheet of Object.values(player)) {
      if (!seen.has(sheet.url)) {
        seen.add(sheet.url);
        const img = new window.Image();
        img.src = sheet.url;
        img.decode?.().catch(() => {});
      }
    }
  }
})();

const PLAYER_LAYOUT = [
  // First Pair (The "Blue" boy and the Purple-haired girl)
  { left: "19.0vw",  bottom: "-1vh", scale: 0.8, z: 33}, // Player 1 (viola1)
  { left: "10vw",  bottom: "1.0vh", scale: 0.78, z: 32 }, // Player 2 (viola2) - Sits next to P1

  // Second Pair (The back row / last two)
  { left: "26.0vw", bottom: "6.0vh", scale: 0.7, z: 25 }, // Player 3 (viola3) - Slightly higher/further back
  { left: "1vw", bottom: "-3vh", scale: 0.8, z: 32 }, // Player 4 (viola4) - Sits next to P3
];

const MIN_PLAY_MS = 240;
const MAX_PLAY_MS = 1200;
const MIN_RETRIGGER_GAP_MS = 190;
const FRAME_STEP_MS = { normal: 92 };
const FRAMES_TO_PLAY = { normal: 6 };

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function chooseVariant() {
  return "normal";
}

function noteMatchesInstrument(noteInstrument) {
  return noteInstrument === "violin" || noteInstrument === "viola" || noteInstrument === "string ensemble 1";
}

function ViolinSpritePlayer({ playerId, section = "left", scale = 0.33, position, zIndex = 32 }) {
  const variants = PLAYER_VARIANTS[playerId];
  const screen = useGameStore((s) => s.screen);
  const highSeq = useGameStore((s) => s.orchestraHighStringSeq);
  const lastNote = useGameStore((s) => s.orchestraSectionLastNote[section]);

  const divRef = useRef(null);
  const animRef = useRef({
    variant: "idle",
    frame: 0,
    frameAt: 0,
    startAt: 0,
    durationMs: 0,
    endFrame: 0,
  });
  const lastTriggerAtRef = useRef(0);

  const anchorH = variants.normal.frameH * scale;
  const anchorW = (variants.normal.frameW / variants.normal.frameH) * anchorH;

  function applyFrame(variant, frame) {
    const el = divRef.current;
    if (!el) return;
    const sheet = variants[variant] ?? variants.idle;
    const safeFrame = Math.max(0, Math.min(frame, sheet.frames - 1));
    const col = safeFrame % sheet.cols;
    const row = Math.floor(safeFrame / sheet.cols);
    const pctX = sheet.cols > 1 ? (col / (sheet.cols - 1)) * 100 : 0;
    const pctY = sheet.rows > 1 ? (row / (sheet.rows - 1)) * 100 : 0;
    el.style.backgroundImage = `url("${sheet.url}")`;
    el.style.backgroundSize = `${sheet.cols * 100}% ${sheet.rows * 100}%`;
    el.style.backgroundPosition = `${pctX}% ${pctY}%`;
  }

  useLayoutEffect(() => {
    applyFrame("idle", 0);
  }, [variants]);

  useEffect(() => {
    if (!lastNote?.at) return;
    if (!noteMatchesInstrument(lastNote.instrument)) return;
    const playerIndex = VIOLISTS.indexOf(playerId);
    if (playerIndex < 0) return;
    if (highSeq <= 0) return;
    if (((highSeq - 1) % VIOLISTS.length) !== playerIndex) return;
    const now = nowMs();
    if (now - lastTriggerAtRef.current < MIN_RETRIGGER_GAP_MS) return;
    lastTriggerAtRef.current = now;

    const variant = chooseVariant();
    const sheet = variants[variant] ?? variants.normal;
    const maxFrames = Math.max(1, Math.min(sheet.frames, FRAMES_TO_PLAY[variant] ?? sheet.frames));
    const durMs = Math.max(MIN_PLAY_MS, Math.min(MAX_PLAY_MS, (lastNote.duration || 0.3) * 1000));

    animRef.current = {
      variant,
      frame: 0,
      frameAt: now,
      startAt: now,
      durationMs: durMs,
      endFrame: Math.max(0, maxFrames - 1),
    };
    applyFrame(variant, 0);
  }, [highSeq, lastNote, playerId, variants]);

  useEffect(() => {
    if (screen !== "playing") return;
    applyFrame("idle", 0);

    let raf = 0;
    const tick = () => {
      const now = nowMs();
      const anim = animRef.current;
      if (!anim.startAt || now - anim.startAt > anim.durationMs) {
        if (anim.variant !== "idle") {
          anim.variant = "idle";
          anim.frame = 0;
          applyFrame("idle", 0);
        }
      } else {
        const stepMs = FRAME_STEP_MS[anim.variant] ?? 90;
        if (now - anim.frameAt >= stepMs) {
          anim.frameAt = now;
          anim.frame = Math.min(anim.endFrame, anim.frame + 1);
          applyFrame(anim.variant, anim.frame);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen, variants]);

  if (screen !== "playing") return null;

  return (
    <div
      ref={divRef}
      className="pointer-events-none fixed"
      style={{
        width: anchorW,
        height: anchorH,
        backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.45))",
        zIndex,
        ...position,
      }}
      aria-hidden
    />
  );
}

const _ALL_SPRITE_URLS = (() => {
  const seen = new Set();
  const urls = [];
  for (const player of Object.values(PLAYER_VARIANTS)) {
    for (const sheet of Object.values(player)) {
      if (!seen.has(sheet.url)) {
        seen.add(sheet.url);
        urls.push(sheet.url);
      }
    }
  }
  return urls;
})();

export function ViolinOrchestraOverlay() {
  const screen = useGameStore((s) => s.screen);
  const { shrinkMul } = useOrchestraSpriteShrinkMul();
  if (screen !== "playing") return null;

  return (
    <>
      {_ALL_SPRITE_URLS.map((url) => (
        <div
          key={url}
          aria-hidden
          style={{
            position: "fixed",
            left: -1000,
            top: -1000,
            width: 1,
            height: 1,
            opacity: 0.001,
            backgroundImage: `url("${url}")`,
            backgroundSize: "cover",
            pointerEvents: "none",
          }}
        />
      ))}
      {VIOLISTS.map((playerId, i) => (
        <ViolinSpritePlayer
          key={playerId}
          playerId={playerId}
          section="left"
          scale={PLAYER_LAYOUT[i].scale * shrinkMul}
          position={{ left: PLAYER_LAYOUT[i].left, bottom: PLAYER_LAYOUT[i].bottom }}
          zIndex={PLAYER_LAYOUT[i].z}
        />
      ))}
    </>
  );
}
