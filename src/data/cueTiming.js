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
  return cue.hitTime + 0.35;
}

/**
 * Time after which an unresolved cue counts as missed.
 * @param {CueDef} cue
 */
export function cueMissDeadline(cue) {
  const hold = cue.holdSec ?? 0;
  if (cue.kind === "holdUp" || cue.kind === "holdDown") {
    return cue.hitTime + hold + 0.2;
  }
  return cue.hitTime + 0.45;
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
    const lo = 0.48;
    const hi = 0.69;
    return clamp01((x - lo) / (hi - lo));
  }
  if (kind === "down" || kind === "holdDown") {
    const hi = 0.52;
    const lo = 0.22;
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
