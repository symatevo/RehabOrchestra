import { useEffect, useLayoutEffect, useRef } from "react";
import { useGameStore } from "../../store/useGameStore.js";
import { publicUrl } from "../../utils/publicUrl.js";

// All dimensions verified from actual image pixel sizes + CSS position tables.
const PLAYER_VARIANTS = {
  cello1: {
    idle:   { url: publicUrl("models/Orchestra/cello1-normal-sprite/spritesheet.png"), frameW: 306, frameH: 485, cols: 4, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/cello1-normal-sprite/spritesheet.png"), frameW: 306, frameH: 485, cols: 4, rows: 2, frames: 8 },
  },
  cello2: {
    idle:   { url: publicUrl("models/Orchestra/cello3-normal-sprite/spritesheet.png"), frameW: 325, frameH: 502, cols: 4, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/cello3-normal-sprite/spritesheet.png"), frameW: 325, frameH: 502, cols: 4, rows: 2, frames: 8 },
  },
  cello3: {
    idle:   { url: publicUrl("models/Orchestra/cello3-normal-sprite/spritesheet.png"), frameW: 325, frameH: 502, cols: 4, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/cello3-normal-sprite/spritesheet.png"), frameW: 325, frameH: 502, cols: 4, rows: 2, frames: 8 },
  },
  cello4: {
    idle:   { url: publicUrl("models/Orchestra/cello4-normal-sprite/spritesheet.png"), frameW: 325, frameH: 496, cols: 4, rows: 2, frames: 1 },
    normal: { url: publicUrl("models/Orchestra/cello4-normal-sprite/spritesheet.png"), frameW: 325, frameH: 496, cols: 4, rows: 2, frames: 8 },
  },
};

const CELLISTS = ["cello1", "cello2", "cello3", "cello4"];

// Preload idle + normal sheets only (short/onfire unused at runtime).
(function preloadAllSprites() {
  if (typeof window === "undefined") return;
  const seen = new Set();
  for (const player of Object.values(PLAYER_VARIANTS)) {
    for (const key of ["idle", "normal"]) {
      const sheet = player[key];
      if (!sheet?.url) continue;
      if (!seen.has(sheet.url)) {
        seen.add(sheet.url);
        const img = new window.Image();
        img.src = sheet.url;
      }
    }
  }
})();
const PLAYER_LAYOUT = [
  { right: "16.0vw",  bottom: "-1vh", scale: 0.8, z: 33},
  { right: "5vw",  bottom: "1.0vh", scale: 0.78, z: 32 },
  { right: "23.0vw", bottom: "7.0vh", scale: 0.65, z: 25 },
  { right: "-4vw", bottom: "-3vh", scale: 0.8, z: 32 },
];

const MIN_PLAY_MS = 240;
const MAX_PLAY_MS = 1200;
const MIN_RETRIGGER_GAP_MS = 190;
const FRAME_STEP_MS = { normal: 92 };
const FRAMES_TO_PLAY = { normal: 6 };

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Cello playback uses only the `normal` sheet (no short / onfire). */
function chooseVariant() {
  return "normal";
}

function noteMatchesInstrument(noteInstrument) {
  return noteInstrument === "cello" || noteInstrument === "contrabass";
}

export function InstrumentSpritePlayer({
  playerId,
  section = "right",
  scale = 0.48,
  position,
  zIndex = 32,
}) {
  const variants = PLAYER_VARIANTS[playerId];
  const screen = useGameStore((s) => s.screen);
  const lastNote = useGameStore((s) => s.orchestraSectionLastNote[section]);

  const divRef = useRef(null);
  // All animation state lives here — never in React state.
  const animRef = useRef({
    variant: "idle",
    frame: 0,
    frameAt: 0,
    startAt: 0,
    durationMs: 0,
    endFrame: 0,
  });
  const lastTriggerAtRef = useRef(0);

  // idle + normal share the same PNG dimensions; sizing uses the active sheet.

  /**
   * Write variant + frame directly to the DOM — atomically, no React render.
   */
  function applyFrame(variant, frame) {
    const el = divRef.current;
    if (!el) return;
    const sheet = variants[variant] ?? variants.idle;
    const safeFrame = Math.max(0, Math.min(frame, sheet.frames - 1));
    const col = safeFrame % sheet.cols;
    const row = Math.floor(safeFrame / sheet.cols);

    const cellH = sheet.frameH * scale;
    const cellW = (sheet.frameW / sheet.frameH) * cellH;
    el.style.width = `${cellW}px`;
    el.style.height = `${cellH}px`;

    el.style.backgroundImage = `url("${sheet.url}")`;
    el.style.backgroundSize = `${sheet.cols * cellW}px ${sheet.rows * cellH}px`;
    el.style.backgroundPosition = `${-col * cellW}px ${-row * cellH}px`;
  }

  // Prime the idle frame before the very first paint so the div is never blank.
  // useLayoutEffect fires synchronously after mount, before the browser paints —
  // React never touches background properties again after this point because they
  // are NOT included in the JSX style prop below.
  useLayoutEffect(() => {
    applyFrame("idle", 0);
  }, [variants]); // re-prime if variants reference changes (practically never)

  // Trigger new animation when a matching note arrives.
  useEffect(() => {
    if (!lastNote?.at) return;
    if (!noteMatchesInstrument(lastNote.instrument)) return;
    const playerIndex = CELLISTS.indexOf(playerId);
    if (playerIndex < 0) return;
    if (lastNote.seq <= 0) return;
    if (((lastNote.seq - 1) % CELLISTS.length) !== playerIndex) return;
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
    // Apply frame 0 of the new variant immediately — no React render needed.
    applyFrame(variant, 0);
  }, [lastNote, playerId, variants]);

  // RAF loop — drives frame stepping directly on the DOM.
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

  // background* properties are intentionally absent from JSX style — they are managed
  // exclusively by applyFrame() so React never overwrites them on re-render.
  return (
    <div
      ref={divRef}
      className="pointer-events-none fixed"
      style={{
        backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.45))",
        zIndex,
        ...position,
      }}
      aria-hidden
    />
  );
}

export function CelloOrchestraOverlay() {
  const screen = useGameStore((s) => s.screen);
  if (screen !== "playing") return null;

  return (
    <>
      {CELLISTS.map((playerId, i) => (
        <InstrumentSpritePlayer
          key={playerId}
          playerId={playerId}
          section="right"
          scale={PLAYER_LAYOUT[i].scale}
          position={{ right: PLAYER_LAYOUT[i].right, bottom: PLAYER_LAYOUT[i].bottom }}
          zIndex={PLAYER_LAYOUT[i].z}
        />
      ))}
    </>
  );
}
