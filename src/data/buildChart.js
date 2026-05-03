/**
 * @typedef {'left' | 'right'} Side
 * @typedef {'left' | 'right' | 'both'} CueSide
 * @typedef {'up' | 'down' | 'holdUp' | 'holdDown' | 'close'} CueKind
 * @typedef {{ id: number; hitTime: number; side: CueSide; travel: number; kind: CueKind; holdSec?: number }} CueDef
 */
import { getOrchestraMeta, getOrchestraTracks } from "./orchestraTracks.js";

/** Beats between alternating down/up cues (tune 1 = every quarter, 2 = every half note, etc.) */
const BEATS_PER_STROKE = 2;

/** @param {CueDef[]} chart */
function assignTravelFromRhythm(chart) {
  chart.forEach((c, i) => {
    const prevHit = i > 0 ? chart[i - 1].hitTime : Math.max(0, c.hitTime - 4);
    const ioi = Math.max(0.82, c.hitTime - prevHit);
    c.travel = Math.min(3.2, Math.max(1.35, ioi * 1.35));
  });
}

/** @typedef {{ t: number; vel: number; midi: number; dur: number }} NoteEv */

/**
 * @param {ReturnType<typeof getOrchestraTracks>} tracks
 * @param {number} startT
 * @param {number} endT
 * @returns {NoteEv[]}
 */
function collectNotes(tracks, startT, endT) {
  /** @type {NoteEv[]} */
  const out = [];
  for (const tr of tracks) {
    for (const n of tr.notes) {
      if (n.time < startT || n.time > endT) continue;
      const midi =
        typeof n.midi === "number"
          ? n.midi
          : guessMidiFromName(/** @type {{ name?: string }} */ (n).name);
      out.push({
        t: n.time,
        vel: n.velocity ?? 0.5,
        midi,
        dur: n.duration ?? 0.1,
      });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** @param {string | undefined} name */
function guessMidiFromName(name) {
  if (!name || typeof name !== "string") return 60;
  const m = name.match(/^([A-Ga-g])([#b]?)(\d+)$/);
  if (!m) return 60;
  const pcs = /** @type {Record<string, number>} */ ({
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  });
  let sem = pcs[m[1].toUpperCase()];
  if (sem === undefined) return 60;
  if (m[2] === "#") sem += 1;
  if (m[2] === "b") sem -= 1;
  const oct = parseInt(m[3], 10);
  return (oct + 1) * 12 + sem;
}

/** @param {NoteEv[]} notes @param {number} mergeSec */
function mergeOnsets(notes, mergeSec) {
  if (!notes.length) return [];
  /** @type {number[]} */
  const out = [];
  for (const n of notes) {
    if (!out.length || n.t - out[out.length - 1] >= mergeSec) {
      out.push(n.t);
    }
  }
  return out;
}

/**
 * Regular conducting grid: one stroke every `BEATS_PER_STROKE` quarter-notes.
 */
function buildStrokeGridTimes(startAt, stopAt, beatSec) {
  const step = BEATS_PER_STROKE * beatSec;
  /** @type {number[]} */
  const out = [];
  for (let k = 0; k < 8000; k += 1) {
    const ht = startAt + k * step;
    if (ht > stopAt - 0.04) break;
    out.push(ht);
  }
  return out;
}

/** @param {number[]} gridTimes @param {number} target */
function nearestGridIndex(gridTimes, target) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < gridTimes.length; i += 1) {
    const d = Math.abs(gridTimes[i] - target);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/**
 * Fist (~40% progress) plus 0–2 holds anchored to largest MIDI rests (nearest grid indices).
 */
function buildHoldFistPlan(gridTimes, onsets, startAt, stopAt, beatSec) {
  const N = gridTimes.length;
  const span = Math.max(1e-6, stopAt - startAt);

  const fistCueIndex = N >= 10 ? Math.max(3, Math.min(N - 4, Math.floor(N * 0.4))) : -1;

  /** @type {Set<number>} */
  const holdCueIds = new Set();
  if (N < 12 || onsets.length < 4) {
    return { fistCueIndex, holdCueIds };
  }

  /** @type {{ gap: number; idx: number }[]} */
  const ranked = [];
  for (let i = 0; i < onsets.length - 1; i += 1) {
    const gap = onsets[i + 1] - onsets[i];
    const mid = (onsets[i] + onsets[i + 1]) / 2;
    const u = (mid - startAt) / span;
    if (u < 0.18 || u > 0.82) continue;
    if (gap < beatSec * 1.02) continue;
    ranked.push({ gap, idx: nearestGridIndex(gridTimes, mid) });
  }
  ranked.sort((a, b) => b.gap - a.gap);

  const want = N >= 18 ? 2 : 1;
  for (const r of ranked) {
    if (holdCueIds.size >= want) break;
    if (
      r.idx === fistCueIndex ||
      r.idx === fistCueIndex - 1 ||
      r.idx === fistCueIndex + 1
    ) {
      continue;
    }
    let tooClose = false;
    for (const h of holdCueIds) {
      if (Math.abs(h - r.idx) < 6) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) holdCueIds.add(r.idx);
  }

  return { fistCueIndex, holdCueIds };
}

/**
 * @param {number} i cue index along grid
 * @param {number} hitTime
 * @param {number[]} gridTimes
 * @param {number} span
 * @param {number} startAt
 * @param {number} beatSec
 * @param {{ fistCueIndex: number; holdCueIds: Set<number> }} plan
 */
function conductorKindSlot(i, hitTime, gridTimes, span, startAt, beatSec, plan) {
  const u = (hitTime - startAt) / span;
  if (plan.fistCueIndex >= 0 && i === plan.fistCueIndex) {
    return { kind: /** @type {CueKind} */ ("close") };
  }

  const gapToNext =
    i < gridTimes.length - 1 ? gridTimes[i + 1] - hitTime : beatSec * 8;

  if (plan.holdCueIds.has(i) && u >= 0.12 && u <= 0.9) {
    const holdSec = Math.max(
      1.05,
      Math.min(2.35, Math.max(gapToNext * 0.55, beatSec * 1.55))
    );
    return { kind: /** @type {CueKind} */ ("holdUp"), holdSec };
  }

  return { kind: /** @type {CueKind} */ ("down") };
}

/**
 * Shift each cue a few milliseconds toward the closest MIDI onset (within neighbours) so strokes
 * “breathe” with the melody without reshuffling cues.
 */
function microWarpTowardOnsets(chart, onsets, maxSec = 0.042) {
  if (!chart.length || !onsets.length) return;
  for (let i = 0; i < chart.length; i += 1) {
    const c = chart[i];
    const lo = i > 0 ? chart[i - 1].hitTime + 0.065 : Number.NEGATIVE_INFINITY;
    const hi =
      i < chart.length - 1 ? chart[i + 1].hitTime - 0.065 : Number.POSITIVE_INFINITY;
    let bestT = c.hitTime;
    let bestDist = Infinity;
    for (const o of onsets) {
      if (o <= lo || o >= hi) continue;
      const d = Math.abs(o - c.hitTime);
      if (d <= maxSec && d < bestDist) {
        bestDist = d;
        bestT = o;
      }
    }
    c.hitTime = Number(bestT.toFixed(4));
  }
}

/**
 * Plain strokes alternate down/up. Each hold mirrors the gesture *opposite* the last plain
 * arrow; the first plain cue after the hold repeats that stroke (“down, holdUp, down…” /
 * “up, holdDown, up…”).
 * @param {CueDef[]} chart
 */
function applyVerticalConductingSequence(chart) {
  let prevPlain = /** @type {"down" | "up"} */ ("up");
  let pendingRepeat = /** @type {"down" | "up" | null} */ (null);

  for (const c of chart) {
    if (c.kind === "close") continue;

    const isHold =
      (typeof c.holdSec === "number" && c.holdSec > 0) ||
      c.kind === "holdUp" ||
      c.kind === "holdDown";

    if (isHold) {
      c.kind = prevPlain === "down" ? "holdUp" : "holdDown";
      pendingRepeat = prevPlain;
      continue;
    }

    if (pendingRepeat !== null) {
      c.kind = pendingRepeat;
      prevPlain = pendingRepeat;
      pendingRepeat = null;
      continue;
    }

    const next = prevPlain === "down" ? "up" : "down";
    c.kind = next;
    prevPlain = next;
  }
}

/**
 * After a hold cue, drop any plain cues whose hitTime falls before `holdEnd + buffer`.
 * @param {CueDef[]} chart
 * @param {number} beatSec
 */
function trimCuesInsideHolds(chart, beatSec) {
  const buffer = Math.max(0.18, beatSec * 0.38);
  /** @type {CueDef[]} */
  const out = [];
  let blockUntil = -Infinity;
  for (const c of chart) {
    if (c.hitTime < blockUntil) continue;
    out.push(c);
    if ((c.kind === "holdUp" || c.kind === "holdDown") && typeof c.holdSec === "number") {
      blockUntil = c.hitTime + c.holdSec + buffer;
    }
  }
  return out;
}

/**
 * Snap strictly increasing hit times onto eighth subdivisions without reordering cues.
 * @param {CueDef[]} chart
 * @param {number} beatSec
 */
function quantizePreserveOrder(chart, beatSec) {
  const step = beatSec / 8;
  const minBump = Math.max(step * 0.25, 0.068);
  let last = -Infinity;
  for (const c of chart) {
    let h = Math.round(c.hitTime / step) * step;
    if (h <= last + minBump - 1e-6) {
      h = Number((last + minBump).toFixed(5));
    }
    c.hitTime = Number(h.toFixed(4));
    last = c.hitTime;
  }
}

/**
 * @param {Side} damagedSide
 * @param {string} [levelId]
 * @returns {CueDef[]}
 */
export function buildCueChart(damagedSide, levelId) {
  const lid = levelId || "level1";
  const meta = getOrchestraMeta(lid);
  const tracks = getOrchestraTracks(lid);
  const beatSec = 60 / meta.bpm;
  const startAt = beatSec * 7;
  const stopAt = Math.max(startAt + beatSec * 4, meta.durationSec - beatSec * 3);
  const span = Math.max(1e-6, stopAt - startAt);

  const notes = collectNotes(tracks, startAt, stopAt);
  const mergedOnsets = mergeOnsets(notes, 0.045);

  const gridTimes = buildStrokeGridTimes(startAt, stopAt, beatSec);
  const plan = buildHoldFistPlan(gridTimes, mergedOnsets, startAt, stopAt, beatSec);

  /** @type {CueDef[]} */
  let chart = gridTimes.map((hitTime, i) => {
    const { kind, holdSec } = conductorKindSlot(
      i,
      hitTime,
      gridTimes,
      span,
      startAt,
      beatSec,
      plan
    );
    return {
      id: i,
      hitTime,
      side: /** @type {CueSide} */ ("both"),
      travel: 2.85,
      kind,
      ...(holdSec !== undefined ? { holdSec } : {}),
    };
  });

  microWarpTowardOnsets(chart, mergedOnsets);
  chart.forEach((c, idx) => {
    c.id = idx;
  });

  applyVerticalConductingSequence(chart);
  chart = trimCuesInsideHolds(chart, beatSec);
  chart.forEach((c, idx) => {
    c.id = idx;
  });
  quantizePreserveOrder(chart, beatSec);
  assignTravelFromRhythm(chart);
  return chart;
}

export function travelSecForCue(_cueIndex, _total) {
  return 2.95;
}

/**
 * @param {Side} damagedSide
 * @param {CueDef[]} chart
 */
export function assertChartValid(damagedSide, chart) {
  for (const c of chart) {
    if (c.side !== "both" && c.side === damagedSide) {
      throw new Error(`Chart invalid at id ${c.id}`);
    }
  }
}
