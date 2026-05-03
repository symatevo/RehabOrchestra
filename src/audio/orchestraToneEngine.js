import * as Tone from "tone";
import {
  instrumentsForZone,
  ORCHESTRA_META,
  ORCHESTRA_TRACKS,
  getOrchestraMeta,
  getOrchestraTracks,
} from "../data/orchestraTracks.js";
import { getSamplerConfig } from "./stringSampleMap.js";

// All levels use the same synced synth orchestra approach; Level 1 = Carnival
// Swan (carnivalSwanSong.json), Level 2 = Eine Kleine Nachtmusik (semiSong.json),
// Level 3 = Yarkhushta-style (yarkhushtaSong.json), Level 4 = Swan Lake
// excerpt (swanLakeSong.json), Level 5 = Nutcracker Pas de deux (nutcrackerPasSong.json).
// Per-level data is resolved via getOrchestraMeta() / getOrchestraTracks()
// inside initOrchestra().

const FALLBACK_TIMBRE = {
  // Fallback voice only (used when sample load fails).
  violin: {
    type: "fatsawtooth",
    spread: 12,
    count: 3,
    attack: 0.02,
    decay: 0.18,
    sustain: 0.52,
    release: 0.42,
    volume: -8.5,
  },
  "string ensemble 1": {
    type: "fatsawtooth",
    spread: 18,
    count: 4,
    attack: 0.026,
    decay: 0.2,
    sustain: 0.58,
    release: 0.5,
    volume: -9,
  },
  viola: {
    type: "fattriangle",
    spread: 8,
    count: 3,
    attack: 0.028,
    decay: 0.2,
    sustain: 0.56,
    release: 0.52,
    volume: -8,
  },
  cello: {
    type: "fatsine",
    spread: 7,
    count: 3,
    attack: 0.038,
    decay: 0.22,
    sustain: 0.62,
    release: 0.62,
    volume: -7,
  },
  contrabass: {
    type: "fatsine",
    spread: 5,
    count: 2,
    attack: 0.05,
    decay: 0.26,
    sustain: 0.66,
    release: 0.74,
    volume: -6.5,
  },
};

/** Loudness stays fixed; cues no longer ride the master fader */
const STATIC_MASTER_DB = -1;

const SAMPLE_GAIN_DB = {
  violin: 1.0,
  "string ensemble 1": 0.45,
  viola: 0.72,
  cello: 1.35,
  contrabass: 0.92,
};

class OrchestraToneEngine {
  constructor() {
    this.ready = false;
    this.expression = 0.5;
    this.zone = 1;
    this.noteCb = null;
    this.parts = [];
    this.synths = new Map();
    this.activeInstruments = new Set(instrumentsForZone(1));
    this.master = null;
    this.reverb = null;
    this.chorus = null;
    this.lowpass = null;
    this.energy = 0;
    this.amplitude = 0;
    this.lastAmpAt = 0;
    this.lastCueAt = 0;
    this.cueFxSynth = null;
    this.lastPlayedNoteName = "C4";
    this.levelId = "level1";
    this.lastProgressTempoMul = 1;
  }

  setLevel(levelId) {
    const next = levelId || "level1";
    if (next === this.levelId) return;
    this.levelId = next;
    // Dispose the entire engine so initOrchestra() rebuilds with the correct
    // per-level song data.  Every operation inside disposeOrchestra() is
    // synchronous so this completes before initOrchestra() runs.
    if (this.ready) this.disposeOrchestra();
  }

  _triggerMissAccent() {
    if (!this.cueFxSynth) return;
    const now = Tone.now();
    const base = this.lastPlayedNoteName || "C4";
    const tensionNote = Tone.Frequency(base).transpose(1).toNote();
    this.cueFxSynth.triggerAttackRelease(tensionNote, 0.055, now, 0.05);
  }

  _brightMixPreset() {
    if (!this.lowpass || !this.reverb || !this.chorus) return;
    this.lowpass.frequency.value = 4800;
    this.reverb.wet.value = 0.21;
    this.chorus.wet.value = 0.12;
  }

  _createFallbackVoice(instrument) {
    const k = FALLBACK_TIMBRE[instrument] ?? FALLBACK_TIMBRE.violin;
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: k.type, spread: k.spread, count: k.count },
      envelope: {
        attack: k.attack,
        decay: k.decay,
        sustain: k.sustain,
        release: k.release,
      },
    }).connect(this.lowpass);
    synth.volume.value = k.volume;
    return synth;
  }

  async _createVoice(instrument) {
    const samplerCfg = getSamplerConfig(instrument);
    if (!samplerCfg) return this._createFallbackVoice(instrument);

    try {
      const sampler = await new Promise((resolve, reject) => {
        let done = false;
        const onResolve = (s) => {
          if (done) return;
          done = true;
          resolve(s);
        };
        const onReject = (err) => {
          if (done) return;
          done = true;
          reject(err);
        };
        const s = new Tone.Sampler({
          urls: samplerCfg.urls,
          attack: samplerCfg.attack,
          release: samplerCfg.release,
          onload: () => onResolve(s),
          onerror: onReject,
        }).connect(this.lowpass);
        setTimeout(() => onReject(new Error(`Sampler load timeout for ${instrument}`)), 14000);
      });
      sampler.volume.value = SAMPLE_GAIN_DB[instrument] ?? -2.5;
      return sampler;
    } catch (err) {
      console.warn(`[orchestraToneEngine] sampler load failed for ${instrument}, using synth fallback`, err);
      return this._createFallbackVoice(instrument);
    }
  }

  async initOrchestra() {
    if (this.ready) return;
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;
    this.lastProgressTempoMul = 1;
    // Level-specific song data (see orchestraTracks.js LEVEL_SONG map).
    const levelMeta = getOrchestraMeta(this.levelId);
    const levelTracks = getOrchestraTracks(this.levelId);
    this.currentMeta = levelMeta;
    Tone.Transport.bpm.value = levelMeta.bpm;
    Tone.Transport.timeSignature = levelMeta.timeSignature;
    Tone.Transport.loop = false;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = levelMeta.durationSec;
    Tone.Transport.swing = 0.08;
    Tone.Transport.swingSubdivision = "8n";

    this.master = new Tone.Volume(STATIC_MASTER_DB).toDestination();
    this.lowpass = new Tone.Filter({ type: "lowpass", frequency: 4800, Q: 0.5 });
    this.reverb = new Tone.Reverb({ decay: 3.4, wet: 0.21 });
    this.chorus = new Tone.Chorus({ frequency: 0.14, delayTime: 2.8, depth: 0.13, wet: 0.12 }).start();
    this.lowpass.connect(this.reverb);
    this.reverb.connect(this.chorus);
    this.chorus.connect(this.master);
    this._brightMixPreset();
    this.cueFxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.012, decay: 0.07, sustain: 0.06, release: 0.16 },
    }).connect(this.lowpass);
    this.cueFxSynth.volume.value = -30;

    for (const t of levelTracks) {
      const voice = await this._createVoice(t.instrument);
      this.synths.set(t.instrument, voice);

      const part = new Tone.Part((time, note) => {
        const raw = Math.min(1, Math.max(0.04, note.velocity));
        const velBase = 0.38 + 0.62 * raw;
        const finalVel = Math.min(1, Math.max(0.12, velBase));
        voice.triggerAttackRelease(
          note.name,
          Math.max(0.05, note.duration),
          time,
          finalVel
        );
        this.lastPlayedNoteName = note.name;
        this.amplitude = Math.max(this.amplitude, finalVel);
        this.lastAmpAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        this.noteCb?.({
          instrument: t.instrument,
          time: Tone.Transport.seconds,
          duration: note.duration,
          velocity: velBase,
          active: true,
        });
      }, t.notes).start(0);
      this.parts.push(part);
    }

    this.setZone(1);
    this.setExpression(0.5);
    this.setEnergy(0);
    this.ready = true;
  }

  /** Kept for call sites; master level is fixed */
  setCueCompliance(_x) {}

  setDuckMultiplier(_x) {}

  setExpression(_x) {
    this.expression = Math.max(0, Math.min(1, _x));
  }

  setEnergy(x) {
    this.energy = Math.max(0, Math.min(100, x));
  }

  setZone(zone) {
    this.zone = zone;
    this.activeInstruments = new Set(instrumentsForZone(zone));
  }

  onNoteEvent(cb) {
    this.noteCb = cb;
  }

  registerCueResult(kind) {
    this.lastCueAt = Tone.now();
    if (kind === "miss") this._triggerMissAccent();
  }

  startOrchestra() {
    if (!this.ready) return;
    this.master?.volume.rampTo(STATIC_MASTER_DB, 0.06);
    if (Tone.Transport.state !== "started") Tone.Transport.start();
  }

  stopOrchestra() {
    if (!this.ready) return;
    // Short fade-out prevents click/noise when session ends.
    this.master?.volume.rampTo(-42, 0.12);
    window.setTimeout(() => {
      Tone.Transport.pause();
    }, 120);
  }

  /** Pause transport without resetting position (camera off during play). */
  pauseGameTransport() {
    if (!this.ready) return;
    if (Tone.Transport.state === "started") Tone.Transport.pause();
  }

  /** Resume after pauseGameTransport; no-op if already running. */
  resumeGameTransport() {
    if (!this.ready) return;
    if (Tone.Transport.state !== "started") Tone.Transport.start();
  }

  restartOrchestra() {
    if (!this.ready) return;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    if (this.currentMeta) Tone.Transport.bpm.value = this.currentMeta.bpm;
    this.lastProgressTempoMul = 1;
  }

  getTime() {
    return Tone.Transport.seconds;
  }

  /**
   * Song progress was used to ramp BPM; that drifted wall-clock vs. Transport and made
   * hit feedback feel increasingly late. Tempo now follows the chart header only.
   * @param {number} _progress01
   */
  updateSongProgress01(_progress01) {
    if (!this.ready || !this.currentMeta) return;
  }

  getDuration() {
    return this.currentMeta?.durationSec ?? ORCHESTRA_META.durationSec;
  }

  getAmplitude() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = Math.max(0, now - this.lastAmpAt);
    const decay = Math.exp(-dt / 260);
    return Math.max(0, Math.min(1, this.amplitude * decay));
  }

  isEnded() {
    return this.getTime() >= this.getDuration();
  }

  async disposeOrchestra() {
    if (!this.ready) return;
    // Mark not-ready first so any concurrent initOrchestra() call sees a clean slate.
    this.ready = false;
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    if (this.currentMeta) Tone.Transport.bpm.value = this.currentMeta.bpm;
    this.lastProgressTempoMul = 1;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    this.synths.forEach((s) => s.dispose());
    this.synths.clear();
    this.reverb?.dispose();
    this.chorus?.dispose();
    this.lowpass?.dispose();
    this.master?.dispose();
    this.reverb = null;
    this.chorus = null;
    this.master = null;
    this.lowpass = null;
    this.energy = 0;
    this.amplitude = 0;
    this.lastAmpAt = 0;
    this.lastCueAt = 0;
    this.cueFxSynth?.dispose();
    this.cueFxSynth = null;
    this.lastPlayedNoteName = "C4";
  }
}

const orchestraToneEngine = new OrchestraToneEngine();

export { orchestraToneEngine };
