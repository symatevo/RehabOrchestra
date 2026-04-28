/**
 * MIDI → orchestra JSON (same shape as yarkhushtaSong.json).
 *
 * Usage:
 *   node scripts/midiToOrchestraJson.mjs <input.mid> <output.json> "Piece name"
 *
 * Paths are relative to the repo root (or absolute).
 *
 * Env:
 *   MIDI_EXCERPT_SEC — max wall-clock seconds (default 220)
 *   MIDI_CHART_BPM — override header bpm for cue grid; if unset, uses heuristic
 *     (if first MIDI tempo > 160 → 80, else clamp raw to 60–120)
 *
 * Pitch thresholds (MIDI note number):
 *   violin >= 72, ensemble >= 66, viola >= 60, cello >= 48, else contrabass
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Midi } = require("@tonejs/midi");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INSTRUMENT_ORDER = [
  "violin",
  "string ensemble 1",
  "viola",
  "cello",
  "contrabass",
];

const MAX_EXCERPT_SEC = Number(process.env.MIDI_EXCERPT_SEC) || 220;

/** @param {number} midi */
function pitchBucket(midi) {
  if (midi >= 72) return "violin";
  if (midi >= 66) return "string ensemble 1";
  if (midi >= 60) return "viola";
  if (midi >= 48) return "cello";
  return "contrabass";
}

/** @param {number[]} arr */
function median(arr) {
  if (!arr.length) return 60;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** @param {import('@tonejs/midi').Note} n */
function noteToJson(n) {
  return {
    time: Number(n.time.toFixed(6)),
    name: n.name,
    midi: n.midi,
    duration: Math.max(0.05, Number(n.duration.toFixed(6))),
    velocity: Number(Math.min(1, Math.max(0.04, n.velocity)).toFixed(6)),
  };
}

/** @param {number} med */
function trackBucketByMedian(med) {
  if (med >= 72) return "violin";
  if (med >= 66) return "string ensemble 1";
  if (med >= 60) return "viola";
  if (med >= 48) return "cello";
  return "contrabass";
}

/** @param {ReturnType<typeof noteToJson>} note */
function clipNoteToExcerpt(note, excerptEnd) {
  if (note.time >= excerptEnd) return null;
  const end = note.time + note.duration;
  if (end > excerptEnd) {
    return {
      ...note,
      duration: Math.max(0.05, Number((excerptEnd - note.time).toFixed(6))),
    };
  }
  return note;
}

const PIANO_REDUCTION_MAX_TRACKS = 2;

const inputRel = process.argv[2];
const outputRel = process.argv[3];
const pieceName = process.argv[4] || "Orchestra (excerpt)";

if (!inputRel || !outputRel) {
  console.error(
    "Usage: node scripts/midiToOrchestraJson.mjs <input.mid> <output.json> [piece name]"
  );
  process.exit(1);
}

const midiPath = resolve(ROOT, inputRel);
const outPath = resolve(ROOT, outputRel);

const buf = readFileSync(midiPath);
const midi = new Midi(buf);

const rawBpm = midi.header.tempos[0]?.bpm ?? 80;
const chartBpmEnv = process.env.MIDI_CHART_BPM;
const bpmRaw = chartBpmEnv
  ? Number(chartBpmEnv)
  : rawBpm > 160
    ? 80
    : Math.min(120, Math.max(60, rawBpm));
const bpm = Number(bpmRaw.toFixed(3));

const timeSignature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
const ppq = midi.header.ppq;

const melodicTracks = midi.tracks.filter(
  (t) => t.notes.length > 0 && !t.instrument.percussion && t.channel !== 9
);

/** @type {Record<string, ReturnType<typeof noteToJson>[]>} */
const buckets = {
  violin: [],
  "string ensemble 1": [],
  viola: [],
  cello: [],
  contrabass: [],
};

if (melodicTracks.length <= PIANO_REDUCTION_MAX_TRACKS) {
  for (const t of melodicTracks) {
    for (const n of t.notes) {
      buckets[pitchBucket(n.midi)].push(noteToJson(n));
    }
  }
} else {
  for (const t of melodicTracks) {
    const med = median(t.notes.map((x) => x.midi));
    const inst = trackBucketByMedian(med);
    for (const n of t.notes) {
      buckets[inst].push(noteToJson(n));
    }
  }
}

for (const k of INSTRUMENT_ORDER) {
  buckets[k] = buckets[k]
    .map((note) => clipNoteToExcerpt(note, MAX_EXCERPT_SEC))
    .filter(Boolean);
  buckets[k].sort((a, b) => a.time - b.time);
}

let maxEnd = 0;
for (const k of INSTRUMENT_ORDER) {
  for (const n of buckets[k]) {
    maxEnd = Math.max(maxEnd, n.time + n.duration);
  }
}
const duration = Math.min(MAX_EXCERPT_SEC + 0.25, Math.max(maxEnd, 1) + 0.08);

const tracks = INSTRUMENT_ORDER.map((instrument, id) => ({
  id,
  instrument,
  startTime: 0,
  duration,
  length: buckets[instrument].length,
  notes: buckets[instrument],
}));

const out = {
  header: {
    PPQ: ppq,
    bpm,
    timeSignature,
    name: pieceName,
  },
  startTime: 0,
  duration,
  tracks,
};

writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${outPath}\n  source: ${midiPath}\n  title: ${pieceName}\n  excerpt: 0–${MAX_EXCERPT_SEC}s  duration: ${duration.toFixed(3)}s  bpm: ${bpm} (MIDI first tempo ${rawBpm})\n  notes: ${tracks.map((t) => `${t.instrument}=${t.length}`).join(", ")}`
);
