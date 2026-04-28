/**
 * @typedef {'left' | 'right'} Side
 * @typedef {'left' | 'right' | 'both'} CueSide
 * @typedef {'up' | 'down' | 'holdUp' | 'holdDown' | 'close'} CueKind
 * @typedef {{ id: number; hitTime: number; side: CueSide; travel: number; kind: CueKind; holdSec?: number }} CueDef
 */
import { getOrchestraMeta, getOrchestraTracks } from "./orchestraTracks.js";

/**
 * @param {CueDef[]} chart
 */
function assignTravelFromRhythm(chart) {
  chart.forEach((c, i) => {
    const prevHit = i > 0 ? chart[i - 1].hitTime : Math.max(0, c.hitTime - 4);
    const ioi = Math.max(0.85, c.hitTime - prevHit);
    c.travel = Math.min(3.9, Math.max(2.05, ioi * 0.66));
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

/** @typedef {{ t: number; medianMidi: number; maxDur: number; maxVel: number }} RichCluster */

/**
 * @param {NoteEv[]} notes
 * @param {number} windowSec
 * @returns {RichCluster[]}
 */
function buildRichClusters(notes, windowSec) {
  /** @type {RichCluster[]} */
  const out = [];
  /** @type {NoteEv[]} */
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const mids = [...cur.map((x) => x.midi)].sort((a, b) => a - b);
    const med = mids[Math.floor(mids.length / 2)];
    let tw = 0;
    let wSum = 0;
    let maxD = 0;
    let maxV = 0;
    for (const x of cur) {
      const w = 0.2 + x.vel;
      tw += x.t * w;
      wSum += w;
      maxD = Math.max(maxD, x.dur);
      maxV = Math.max(maxV, x.vel);
    }
    out.push({ t: tw / wSum, medianMidi: med, maxDur: maxD, maxVel: maxV });
    cur = [];
  };
  for (const n of notes) {
    if (!cur.length || n.t - cur[0].t <= windowSec) {
      cur.push(n);
    } else {
      flush();
      cur = [n];
    }
  }
  flush();
  return out;
}

/**
 * How far apart cues are by piece progress: slow → denser → easy again.
 * @param {number} u 0..1 normalized time in piece
 * @param {number} beatSec
 */
function minGapForProgress(u, beatSec) {
  if (u <= 0.16) return Math.max(3.55, beatSec * 6.5);
  if (u <= 0.38) return Math.max(2.65, beatSec * 5);
  if (u <= 0.62) return Math.max(1.95, beatSec * 3.85);
  if (u <= 0.8) return Math.max(1.72, beatSec * 3.35);
  return Math.max(2.95, beatSec * 5.5);
}

/**
 * @param {RichCluster[]} clusters
 * @param {number} startAt
 * @param {number} stopAt
 * @param {number} beatSec
 */
function thinClustersVariable(clusters, startAt, stopAt, beatSec) {
  const span = Math.max(1e-6, stopAt - startAt);
  /** @type {RichCluster[]} */
  const out = [];
  let last = -1e9;
  for (const c of clusters) {
    const u = (c.t - startAt) / span;
    const needGap = minGapForProgress(u, beatSec);
    if (c.t - last >= needGap) {
      out.push(c);
      last = c.t;
    }
  }
  return out;
}

/** Classic four-beat outline: downbeat / up / down / up (simplified conducting). */
const CONDUCTOR_BEAT = /** @type {const} */ (["down", "up", "down", "up"]);

/**
 * @param {RichCluster} c
 * @param {RichCluster | null} next
 * @param {number} delta medianMidi vs previous cluster
 * @param {number} beatSec
 * @param {number} cueIndex
 * @param {number} u progress 0..1 in piece
 * @returns {{ kind: CueKind; holdSec?: number }}
 */
function conductorKind(c, next, delta, beatSec, cueIndex, u) {
  const gapToNext = next ? next.t - c.t : beatSec * 8;
  const marcato = c.maxVel >= 0.8 && c.maxDur < beatSec * 0.5;
  const longNote = c.maxDur >= beatSec * 1.55;
  const longGap = gapToNext >= beatSec * 3.15;

  const holdMid =
    u >= 0.2 &&
    u <= 0.72 &&
    longGap &&
    cueIndex % 7 === 4 &&
    (longNote || gapToNext >= beatSec * 3.85);
  const holdWind =
    u > 0.72 &&
    u < 0.84 &&
    longGap &&
    gapToNext >= beatSec * 4.4 &&
    cueIndex % 9 === 5;

  if (holdMid || holdWind) {
    const holdSec = Math.min(
      2.65,
      Math.max(1.12, Math.min(gapToNext * 0.42, c.maxDur + beatSec * 0.72))
    );
    const hiPhrase = c.medianMidi >= 62 || delta > 2;
    if (hiPhrase) return { kind: "holdUp", holdSec };
    return { kind: "holdDown", holdSec };
  }

  const fistMid = u >= 0.26 && u <= 0.66 && cueIndex % 11 === 8;
  const fistOk = u >= 0.14 && u <= 0.88 && (marcato || fistMid);
  if (fistOk && !(u < 0.22 && !marcato)) {
    return { kind: "close" };
  }

  const stroke = cueIndex % 4;
  let kind = CONDUCTOR_BEAT[stroke];
  if (delta > 6) kind = "up";
  if (delta < -6) kind = "down";
  return { kind };
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

  const clusterWin = Math.min(0.42, beatSec * 0.55);
  const notes = collectNotes(tracks, startAt, stopAt);
  const rich = thinClustersVariable(
    buildRichClusters(notes, clusterWin),
    startAt,
    stopAt,
    beatSec
  );

  /** @type {CueDef[]} */
  const chart = [];

  if (!rich.length) {
    let t = startAt;
    let id = 0;
    while (t <= stopAt) {
      const u = (t - startAt) / span;
      const gapBeats =
        u <= 0.16 ? 6.8 : u <= 0.38 ? 5.4 : u <= 0.62 ? 4.3 : u <= 0.8 ? 3.7 : 6;
      const fakeNext =
        t + gapBeats * beatSec <= stopAt
          ? {
              t: t + gapBeats * beatSec,
              medianMidi: 60,
              maxDur: 0.15,
              maxVel: 0.5,
            }
          : null;
      const fakeC = { t, medianMidi: 60 + (id % 3) * 2, maxDur: 0.2, maxVel: 0.55 };
      const prevMidi = id > 0 ? 60 + ((id - 1) % 3) * 2 : 60;
      const delta = fakeC.medianMidi - prevMidi;
      const { kind, holdSec } = conductorKind(fakeC, fakeNext, delta, beatSec, id, u);
      chart.push({
        id: id++,
        hitTime: Number(t.toFixed(3)),
        side: "both",
        travel: 3.1,
        kind,
        ...(holdSec ? { holdSec } : {}),
      });
      t += gapBeats * beatSec;
    }
  } else {
    let id = 0;
    for (let i = 0; i < rich.length; i += 1) {
      const c = rich[i];
      const next = rich[i + 1] ?? null;
      const prevMidi = i > 0 ? rich[i - 1].medianMidi : 60;
      const delta = c.medianMidi - prevMidi;
      const u = (c.t - startAt) / span;
      const { kind, holdSec } = conductorKind(c, next, delta, beatSec, id, u);
      chart.push({
        id: id++,
        hitTime: Number(c.t.toFixed(3)),
        side: "both",
        travel: 3.1,
        kind,
        ...(holdSec ? { holdSec } : {}),
      });
    }
  }

  assignTravelFromRhythm(chart);
  return chart;
}

export function travelSecForCue(_cueIndex, _total) {
  return 3.35;
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
