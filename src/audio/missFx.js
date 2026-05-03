import * as Tone from "tone";

let ctxCache = null;

function ensureCtx() {
  if (ctxCache) return ctxCache;
  try {
    const raw = Tone.getContext()?.rawContext;
    if (raw instanceof AudioContext) {
      ctxCache = raw;
      return ctxCache;
    }
  } catch (_) {
    /* ignore */
  }
  ctxCache = new AudioContext();
  return ctxCache;
}

/** Prefer raw AudioContext scheduling so cue chimes latch to the DAC clock immediately (Tone.now can jitter vs. RAF). */
function sfxStartTime(ctx) {
  const c = ctx.currentTime;
  return Number.isFinite(c) ? c : 0;
}

export function resumeAudioContext() {
  const ctx = ensureCtx();
  return ctx.resume().catch(() => {});
}

/** Miss feedback is visual + light accent only; orchestra level stays fixed in `orchestraToneEngine`. */
export function playMissDuck() {}

/**
 * Short drum-like transient + bright chime, timed to the shared audio clock.
 * @param {'perfect' | 'late'} kind
 */
export function playCueHitSfx(kind) {
  const ctx = ensureCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t0 = sfxStartTime(ctx);
  const late = kind === "late";
  const chimeGain = late ? 0.72 : 1;

  const dur = 0.055;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.01));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const drum = ctx.createBufferSource();
  drum.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = late ? 195 : 210;
  bp.Q.value = 0.85;
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0, t0);
  dg.gain.linearRampToValueAtTime(late ? 0.11 : 0.15, t0 + 0.003);
  dg.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.05);
  drum.connect(bp);
  bp.connect(dg);
  dg.connect(ctx.destination);
  drum.start(t0);
  drum.stop(t0 + dur);

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc2.type = "sine";
  osc3.type = "sine";
  osc.frequency.setValueAtTime(523.25, t0);
  osc2.frequency.setValueAtTime(783.99, t0);
  osc3.frequency.setValueAtTime(1046.5, t0);
  osc.frequency.exponentialRampToValueAtTime(659.25, t0 + 0.09);
  osc2.frequency.exponentialRampToValueAtTime(987.77, t0 + 0.09);
  osc3.frequency.exponentialRampToValueAtTime(1318.51, t0 + 0.09);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.055 * chimeGain, t0 + 0.018);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  osc.connect(g);
  osc2.connect(g);
  osc3.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc2.start(t0);
  osc3.start(t0);
  osc.stop(t0 + 0.22);
  osc2.stop(t0 + 0.22);
  osc3.stop(t0 + 0.22);
}

/** @deprecated Use playCueHitSfx('perfect') */
export function playPerfectChime() {
  playCueHitSfx("perfect");
}

export function playApplauseBurst() {
  const ctx = ensureCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  // Build a clap-like crowd texture (short transient bursts), much more natural
  // than a single white-noise hit.
  const dur = 1.8;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 0.7;
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 520;
  const g = ctx.createGain();
  g.gain.value = 0.0;
  band.connect(high);
  high.connect(g);
  g.connect(ctx.destination);

  const start = ctx.currentTime + 0.02;
  const clapCount = 54;
  for (let i = 0; i < clapCount; i++) {
    const t = start + Math.random() * dur;
    const burst = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.028), ctx.sampleRate);
    const data = burst.getChannelData(0);
    for (let s = 0; s < data.length; s++) {
      const env = Math.exp(-s / (ctx.sampleRate * 0.006));
      data[s] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = burst;
    src.connect(band);
    src.start(t);
    src.stop(t + 0.03);
  }

  g.gain.setValueAtTime(0.0, start);
  g.gain.linearRampToValueAtTime(0.22, start + 0.12);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
}
