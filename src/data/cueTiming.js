/**
 * @typedef {import('./buildChart.js').CueDef} CueDef
 */

/**
 * Progress 0..1 for a cue toward its hit (1 = on-beat).
 * @param {number} audioTime
 * @param {CueDef} cue
 */
export function cueProgress(audioTime, cue) {
  const travel = cue.travel > 0 ? cue.travel : 1.85;
  const spawn = cue.hitTime - travel;
  return (audioTime - spawn) / travel;
}

/**
 * Pose only affects **orchestra volume** once the cue is in the latter part of its approach
 * (or into the hold tail). Earlier travel is preview-only — avoids random ducking the moment an
 * arrow spawns before the player can react.
 * @param {number} audioTime
 * @param {CueDef} cue
 */
export function cueOrchestraGateIncludes(audioTime, cue) {
  const travel = cue.travel > 0 ? cue.travel : 1.85;
  const spawn = cue.hitTime - travel;
  const end = cueActiveWindowEnd(cue);
  if (audioTime < spawn || audioTime > end) return false;
  const p = (audioTime - spawn) / Math.max(travel, 1e-6);

  const kind = cue.kind ?? "close";

  const lateEnough = (() => {
    if (kind === "holdUp" || kind === "holdDown") {
      return audioTime >= cue.hitTime - Math.min(travel * 0.38, 0.55);
    }
    if (kind === "close") {
      return audioTime >= cue.hitTime - Math.min(travel * 0.45, 0.6);
    }
    return p >= 0.48;
  })();

  if (!lateEnough) return false;

  if (kind !== "holdUp" && kind !== "holdDown") {
    const tail = kind === "close" ? 0.06 : 0.2;
    if (audioTime > cue.hitTime + tail) return false;
  }

  return true;
}

/** @param {CueDef} cue */
export function cueTravelSec(cue) {
  return cue.travel > 0 ? cue.travel : 1.85;
}

/**
 * End of the "active" window for gating / visuals (includes hold tail).
 * @param {CueDef} cue
 */
export function cueActiveWindowEnd(cue) {
  const hold = cue.holdSec ?? 0;
  if (cue.kind === "holdUp" || cue.kind === "holdDown") {
    return cue.hitTime + hold + 0.12;
  }
  return cue.hitTime + 0.48;
}

/**
 * Time after which an unresolved cue counts as missed.
 * @param {CueDef} cue
 */
export function cueMissDeadline(cue) {
  const hold = cue.holdSec ?? 0;
  if (cue.kind === "holdUp" || cue.kind === "holdDown") {
    return cue.hitTime + hold + 0.28;
  }
  return cue.hitTime + 0.62;
}

/**
 * 0..1 how well `expression01` / fist match this cue (for volume gating).
 * @param {CueDef} cue
 * @param {number} expression01
 * @param {boolean} workingFist
 */
export function cueMatchScore(cue, expression01, workingFist) {
  const kind = cue.kind ?? "close";
  const x = Math.max(0, Math.min(1, expression01));

  if (kind === "close") {
    return workingFist ? 1 : 0;
  }
  if (kind === "up" || kind === "holdUp") {
    const lo = 0.38;
    const hi = 0.78;
    return clamp01((x - lo) / (hi - lo));
  }
  if (kind === "down" || kind === "holdDown") {
    const hi = 0.56;
    const lo = 0.18;
    return clamp01((hi - x) / (hi - lo));
  }
  return 0;
}

/** @param {number} v */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * @param {number} audioTime
 * @param {CueDef} cue
 * @returns {'idle' | 'travel' | 'hold' | 'after'}
 */
export function cuePhase(audioTime, cue) {
  const travel = cueTravelSec(cue);
  const spawn = cue.hitTime - travel;
  const hold = cue.holdSec ?? 0;
  if (audioTime < spawn) return "idle";
  if (audioTime < cue.hitTime) return "travel";
  if (
    (cue.kind === "holdUp" || cue.kind === "holdDown") &&
    audioTime < cue.hitTime + hold
  ) {
    return "hold";
  }
  return "after";
}
