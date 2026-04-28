/* eslint-disable no-console */
// One-shot composer: generates a Yarkhushta-style arrangement for 5 strings
// in the same JSON shape as semiSong.json so the existing Tone.Parts engine
// can schedule it.  Run once with: node scripts/composeYarkhushta.js
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BPM = 138;
const BEAT = 60 / BPM;          // quarter = 0.4348 s
const S = BEAT / 4;              // 16th note
const BAR = BEAT * 4;            // 4/4 bar = 1.7391 s
const BARS = 24;                 // ~41.7 seconds total
const DURATION = BARS * BAR;

// E Phrygian-dominant scale (characteristic Armenian/Middle-Eastern color):
// E  F  G#  A  B  C  D   — semitones 0,1,4,5,7,8,10 from E
const DEG_SEMI = [0, 1, 4, 5, 7, 8, 10];
const MIDI_BY_DEGREE_OCT = (deg, baseMidi) => baseMidi + DEG_SEMI[((deg % 7) + 7) % 7] + Math.floor(deg / 7) * 12;
const MIDI_TO_NAME = (midi) => {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = NAMES[midi % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${name}${oct}`;
};

// Octave roots (MIDI): E2=40, E3=52, E4=64, E5=76
const E2 = 40, E3 = 52, E4 = 64, E5 = 76;

// Compose a note
const N = (time, name, duration, velocity) => ({
  time: Number(time.toFixed(4)),
  name,
  midi: NAME_TO_MIDI(name),
  duration: Number(duration.toFixed(4)),
  velocity: Number(velocity.toFixed(4)),
});

function NAME_TO_MIDI(name) {
  const m = name.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!m) throw new Error(`Bad note name ${name}`);
  const [, letter, acc, octStr] = m;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
  const offset = acc === "#" ? 1 : acc === "b" ? -1 : 0;
  return base + offset + (Number(octStr) + 1) * 12;
}

// Convert (degree, baseOctRoot) -> note name
const DN = (deg, baseMidi) => MIDI_TO_NAME(MIDI_BY_DEGREE_OCT(deg, baseMidi));

// ======================================================================
// Rhythm patterns (per bar, length in 16th notes; rests represented as null)
// Each entry = { deg, s (length in 16ths) } or null for rest
// ======================================================================

// Violin main melody — 4-bar phrase (covers bars 1..4), repeated/varied
// Degrees above E5 (baseMidi = E5 = 76)
const MELODY_A = [
  // bar 1 — call
  [ { deg: 0, s: 2 }, { deg: 1, s: 1 }, { deg: 0, s: 1 },
    { deg: 2, s: 2 }, { deg: 3, s: 2 },
    { deg: 2, s: 2 }, { deg: 0, s: 2 },
    { deg: -1, s: 2 } ], // "-1" means below root: D5 (actually deg=-1 uses scale wrap)
  // bar 2 — response
  [ { deg: 4, s: 2 }, { deg: 3, s: 1 }, { deg: 2, s: 1 },
    { deg: 1, s: 2 }, { deg: 0, s: 2 },
    { deg: 1, s: 2 }, { deg: 2, s: 2 },
    { deg: 0, s: 2 } ],
  // bar 3 — climb
  [ { deg: 2, s: 2 }, { deg: 3, s: 1 }, { deg: 2, s: 1 },
    { deg: 4, s: 2 }, { deg: 5, s: 2 },
    { deg: 4, s: 2 }, { deg: 3, s: 2 },
    { deg: 2, s: 2 } ],
  // bar 4 — cadence back to root
  [ { deg: 4, s: 2 }, { deg: 3, s: 2 },
    { deg: 2, s: 2 }, { deg: 1, s: 2 },
    { deg: 0, s: 4 },
    { deg: 0, s: 4 } ],
];

// Violin high-variation phrase (used for bars 13..16, climax)
const MELODY_B = [
  // bar 1 — driving pulses, higher
  [ { deg: 4, s: 1 }, { deg: 5, s: 1 }, { deg: 4, s: 1 }, { deg: 3, s: 1 },
    { deg: 4, s: 2 }, { deg: 2, s: 2 },
    { deg: 3, s: 2 }, { deg: 4, s: 2 },
    { deg: 2, s: 2 } ],
  // bar 2
  [ { deg: 7, s: 2 }, { deg: 6, s: 2 }, { deg: 5, s: 2 }, { deg: 4, s: 2 },
    { deg: 5, s: 2 }, { deg: 4, s: 2 }, { deg: 2, s: 2 }, { deg: 0, s: 2 } ],
  // bar 3 — turn
  [ { deg: 2, s: 1 }, { deg: 3, s: 1 }, { deg: 4, s: 2 },
    { deg: 5, s: 1 }, { deg: 4, s: 1 }, { deg: 3, s: 2 },
    { deg: 2, s: 1 }, { deg: 1, s: 1 }, { deg: 0, s: 2 },
    { deg: -1, s: 2 }, { deg: 0, s: 2 } ],
  // bar 4 — cadence
  [ { deg: 3, s: 4 }, { deg: 2, s: 4 }, { deg: 1, s: 4 }, { deg: 0, s: 4 } ],
];

// Cello/contrabass ostinato — 2-bar pattern
// Cello pattern: bass dance: quarter-quarter-eighth-eighth-quarter
const CELLO_OSTINATO = [
  // bar: 4 beats, strong driving
  [ { deg: 0, s: 4 }, { deg: 4, s: 4 }, { deg: 0, s: 2 }, { deg: 2, s: 2 }, { deg: 4, s: 4 } ],
  [ { deg: 0, s: 4 }, { deg: -3, s: 4 }, { deg: 0, s: 2 }, { deg: 4, s: 2 }, { deg: 0, s: 4 } ],
];

// Contrabass — simpler pedal with accents
const BASS_PATTERN = [
  [ { deg: 0, s: 4 }, null, { deg: 0, s: 2 }, null, { deg: 0, s: 4 }, { deg: -3, s: 2 } ],
  [ { deg: 0, s: 4 }, null, { deg: 0, s: 2 }, null, { deg: -3, s: 2 }, { deg: 0, s: 4 }, { deg: 0, s: 2 } ],
];

// Viola counter-melody on off-beats (octave 4)
const VIOLA_COUNTER = [
  [ null, { deg: 2, s: 2 }, null, { deg: 4, s: 2 }, null, { deg: 2, s: 2 }, null, { deg: 3, s: 2 } ],
  [ null, { deg: 3, s: 2 }, null, { deg: 2, s: 2 }, null, { deg: 4, s: 2 }, null, { deg: 0, s: 2 } ],
];

// String ensemble — slow pads in 4ths/5ths, doubling melody 8va below (octave 4)
// For simplicity: sustained chords every 2 bars
const ENSEMBLE_PADS = [
  // bar pair 1–2
  [ { deg: 0, s: 16 }, { deg: 2, s: 16 } ],
  // bar pair 3–4
  [ { deg: 4, s: 16 }, { deg: 0, s: 16 } ],
];

// ======================================================================
// Utility to turn a 16th-note pattern into a stream of notes starting at barStart
// ======================================================================
function renderPattern(pattern, barStart, baseMidi, velocityBase) {
  const notes = [];
  let t = barStart;
  for (const step of pattern) {
    const dur = step === null ? 0 : step.s * S;
    if (step && step.deg !== undefined) {
      notes.push(N(t, DN(step.deg, baseMidi), Math.max(0.08, dur * 0.92), velocityBase));
    }
    if (step === null) {
      // treat null as a rest of s=2 (8th)
      t += 2 * S;
    } else {
      t += dur;
    }
  }
  return notes;
}

// ======================================================================
// Arrange — 24 bars, sections:
//   bars  1–4  : intro (bass + viola, violin tacet, pads)
//   bars  5–8  : theme A (violin MELODY_A bars 1..4)
//   bars  9–12 : theme A variation (MELODY_A shifted +2 deg on bars 1..2)
//   bars 13–16 : theme B climax (MELODY_B bars 1..4)
//   bars 17–20 : theme A reprise (MELODY_A bars 1..4)
//   bars 21–24 : outro (cadence, thinning texture)
// ======================================================================

const violin = [];
const ensemble = [];
const viola = [];
const cello = [];
const contrabass = [];

for (let bar = 0; bar < BARS; bar++) {
  const barStart = bar * BAR;
  const ostBar = bar % 2;
  const pairBar = Math.floor(bar / 2) % ENSEMBLE_PADS.length;

  // ===== Cello ostinato (always present except very beginning) =====
  if (bar >= 0) {
    const vel = bar < 2 ? 0.55 : bar < 4 ? 0.7 : bar >= 20 ? 0.55 : 0.82;
    cello.push(...renderPattern(CELLO_OSTINATO[ostBar], barStart, E3, vel));
  }

  // ===== Contrabass pedal =====
  if (bar >= 0) {
    const vel = bar < 2 ? 0.5 : bar < 4 ? 0.6 : bar >= 22 ? 0.5 : 0.78;
    contrabass.push(...renderPattern(BASS_PATTERN[ostBar], barStart, E2, vel));
  }

  // ===== Viola counter-melody (enters bar 3) =====
  if (bar >= 2 && bar < 22) {
    const vel = 0.58 + (bar >= 12 && bar < 16 ? 0.18 : 0);
    viola.push(...renderPattern(VIOLA_COUNTER[ostBar], barStart, E4, vel));
  }

  // ===== String ensemble pads (every 2 bars) =====
  if (bar % 2 === 0 && bar >= 2 && bar < 22) {
    const pair = ENSEMBLE_PADS[pairBar];
    const chord = pair[ostBar] ?? pair[0];
    if (chord) {
      const padBase = E4;
      const vel = 0.35;
      // Double bar-long sustain in 3rds: root + third
      ensemble.push(N(barStart, DN(chord.deg, padBase), 2 * BAR * 0.96, vel));
      ensemble.push(N(barStart, DN(chord.deg + 2, padBase), 2 * BAR * 0.96, vel * 0.9));
    }
  }

  // ===== Violin melody =====
  const section =
    bar >= 4 && bar < 8  ? { phrase: MELODY_A, idx: bar - 4,  shift: 0, vel: 0.82 } :
    bar >= 8 && bar < 12 ? { phrase: MELODY_A, idx: bar - 8,  shift: 2, vel: 0.88 } :
    bar >= 12 && bar < 16 ? { phrase: MELODY_B, idx: bar - 12, shift: 0, vel: 0.95 } :
    bar >= 16 && bar < 20 ? { phrase: MELODY_A, idx: bar - 16, shift: 0, vel: 0.85 } :
    bar >= 20 && bar < 24 ? { phrase: MELODY_A, idx: bar - 20, shift: 0, vel: 0.7 } :
    null;

  if (section) {
    const pat = section.phrase[section.idx].map((step) =>
      step ? { ...step, deg: step.deg + section.shift } : null
    );
    violin.push(...renderPattern(pat, barStart, E5, section.vel));
    // Ensemble doubles violin one octave below at 55% velocity
    ensemble.push(...renderPattern(pat, barStart, E4, section.vel * 0.45));
  }
}

const tracks = [
  { id: 0, instrument: "violin",             startTime: 0, duration: DURATION, length: violin.length,     notes: violin },
  { id: 1, instrument: "string ensemble 1",  startTime: 0, duration: DURATION, length: ensemble.length,   notes: ensemble },
  { id: 2, instrument: "viola",              startTime: 0, duration: DURATION, length: viola.length,      notes: viola },
  { id: 3, instrument: "cello",              startTime: 0, duration: DURATION, length: cello.length,      notes: cello },
  { id: 4, instrument: "contrabass",         startTime: 0, duration: DURATION, length: contrabass.length, notes: contrabass },
];

const out = {
  header: {
    PPQ: 480,
    bpm: BPM,
    timeSignature: [4, 4],
    name: "Yarkhushta (folk-style arrangement)",
  },
  startTime: 0,
  duration: DURATION,
  tracks,
};

const outPath = resolve("src/data/orchestra/yarkhushtaSong.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(
  `Wrote ${outPath}:  bars=${BARS}  duration=${DURATION.toFixed(3)}s  notes: ` +
  tracks.map((t) => `${t.instrument}=${t.notes.length}`).join(", ")
);
