import * as Tone from "tone";
import {
  instrumentsForZone,
  ORCHESTRA_META,
  ORCHESTRA_TRACKS,
  getOrchestraMeta,
  getOrchestraTracks,
} from "../data/orchestraTracks.js";
import { getSamplerConfig } from "./stringSampleMap.js";

// All levels use the same synced synth orchestra approach; Level 1 plays
// Eine Kleine Nachtmusik (semiSong.json), Level 2 a Yarkhushta-style
// arrangement (yarkhushtaSong.json), Level 3 a Swan Lake excerpt
// (swanLakeSong.json), Level 4 Nutcracker Pas de deux (nutcrackerPasSong.json).
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

const SAMPLE_GAIN_DB = {
  violin: -0.8,
  "string ensemble 1": -1.4,
  viola: -1.2,
  cello: -0.6,
  contrabass: -1.0,
};

class OrchestraToneEngine {
  constructor() {
    this.ready = false;
    this.expression = 0.5;
    this.zone = 1;
    this.duckMultiplier = 1;
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
    this.cueBoost = 0.34;
    this.lastCueAt = 0;
    this.cuePresence = 0;
    this.cueCompliance = 1;
    this.cueComplianceSmooth = 1;
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

  _cuePresenceFor(kind) {
    if (kind === "perfect") return 0.48;
    if (kind === "late") return 0.26;
    return 0;
  }

  _triggerMissAccent() {
    if (!this.cueFxSynth) return;
    const now = Tone.now();
    // Subtle musical tension: minor second from most recent note.
    const base = this.lastPlayedNoteName || "C4";
    const tensionNote = Tone.Frequency(base).transpose(1).toNote();
    this.cueFxSynth.triggerAttackRelease(tensionNote, 0.09, now, 0.06);
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
    // Level-specific song data: Level 1 = Eine Kleine Nachtmusik,
    // Level 2 = Yarkhushta-style arrangement.
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

    this.master = new Tone.Volume(-7.8).toDestination();
    this.lowpass = new Tone.Filter({ type: "lowpass", frequency: 2400, Q: 0.5 });
    this.reverb = new Tone.Reverb({ decay: 3.4, wet: 0.2 });
    this.chorus = new Tone.Chorus({ frequency: 0.14, delayTime: 2.8, depth: 0.13, wet: 0.045 }).start();
    this.lowpass.connect(this.reverb);
    this.reverb.connect(this.chorus);
    this.chorus.connect(this.master);
    this.cueFxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.012, decay: 0.07, sustain: 0.06, release: 0.16 },
    }).connect(this.lowpass);
    this.cueFxSynth.volume.value = -30;

    for (const t of levelTracks) {
      const voice = await this._createVoice(t.instrument);
      this.synths.set(t.instrument, voice);

      const part = new Tone.Part((time, note) => {
        const active = this.activeInstruments.has(t.instrument);
        const vel = Math.min(1, Math.max(0.04, note.velocity * (0.28 + this.expression * 0.82)));
        // Keep orchestra cohesive: all sections always play in sync.
        // Zone/cue now emphasizes the currently-conducted section instead of muting others.
        const recentCue = this.lastCueAt ? Math.max(0, 1 - (Tone.now() - this.lastCueAt) / 0.55) : 0;
        const cueLift = Math.max(0.18, Math.min(1, this.cueBoost * (0.58 + recentCue * 0.42)));
        const sectionMix = active ? 1 : 0.62;
        const finalVel = Math.min(1, vel * sectionMix * (active ? cueLift : 1));
        const presence = this.cuePresence * (0.45 + recentCue * 0.55);
        voice.triggerAttackRelease(
          note.name,
          Math.max(0.05, note.duration),
          time,
          finalVel
        );
        // Cue-driven musical lift: add a soft octave/harmonic support only when
        // cues are performed well, so player actions shape the sound in realtime.
        if (presence > 0.05) {
          const upper = Tone.Frequency(note.name).transpose(12).toNote();
          this.cueFxSynth?.triggerAttackRelease(
            upper,
            Math.max(0.035, note.duration * 0.75),
            time,
            Math.min(0.12, finalVel * presence * (active ? 0.22 : 0.12))
          );
        }
        this.lastPlayedNoteName = note.name;
        this.amplitude = Math.max(this.amplitude, finalVel);
        this.lastAmpAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        this.noteCb?.({
          instrument: t.instrument,
          time: Tone.Transport.seconds,
          duration: note.duration,
          velocity: vel,
          active,
        });
      }, t.notes).start(0);
      this.parts.push(part);
    }

    this.setZone(1);
    this.setExpression(0.5);
    this.setDuckMultiplier(1);
    this.setEnergy(0);
    this.cueCompliance = 1;
    this.cueComplianceSmooth = 1;
    this.ready = true;
  }

  _applyMasterVolume() {
    if (!this.master) return;
    this.cueComplianceSmooth +=
      (this.cueCompliance - this.cueComplianceSmooth) * 0.32;
    const loud = 0.14 + this.expression * 0.86;
    const gate =
      0.14 + 0.86 * Math.max(0, Math.min(1, this.cueComplianceSmooth));
    const gain = Math.max(0.06, Math.min(1, loud * this.duckMultiplier * gate));
    const db = Tone.gainToDb(gain);
    this.master.volume.rampTo(db, 0.045);
  }

  /**
   * While a cue is active, pass 0..1 match so wrong pose ducks the orchestra quickly.
   * @param {number} x
   */
  setCueCompliance(x) {
    this.cueCompliance = Math.max(0, Math.min(1, x));
    this._applyMasterVolume();
  }

  setExpression(x) {
    this.expression = Math.max(0, Math.min(1, x));
    this._applyMasterVolume();
  }

  setDuckMultiplier(x) {
    this.duckMultiplier = Math.max(0.05, Math.min(1, x));
    this._applyMasterVolume();
  }

  setEnergy(x) {
    this.energy = Math.max(0, Math.min(100, x));
    if (!this.lowpass || !this.reverb || !this.chorus) return;
    const t = this.energy / 100;
    const cutoff = 2200 + t * 4200;
    this.lowpass.frequency.rampTo(cutoff, 0.08);
    const grandLift = t >= 1 ? 1 : 0;
    this.reverb.wet.rampTo(0.12 + grandLift * 0.13, 0.12);
    this.chorus.wet.rampTo(0.08 + grandLift * 0.08, 0.12);
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
    this.cuePresence = this._cuePresenceFor(kind);
    if (kind === "perfect") this.cueBoost = 1;
    else if (kind === "late") this.cueBoost = 0.58;
    else {
      this.cueBoost = 0.12;
      this._triggerMissAccent();
    }
  }

  startOrchestra() {
    if (!this.ready) return;
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
   * Speed up tempo slightly toward the end of the piece (wall-clock difficulty).
   * @param {number} progress01 0..1
   */
  updateSongProgress01(progress01) {
    if (!this.ready || !this.currentMeta) return;
    const p = Math.max(0, Math.min(1, progress01));
    const mul = 1 + p * 0.18;
    if (Math.abs(mul - this.lastProgressTempoMul) < 0.002) return;
    this.lastProgressTempoMul = mul;
    const target = this.currentMeta.bpm * mul;
    Tone.Transport.bpm.rampTo(target, 0.14);
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
    this.cueBoost = 0.34;
    this.lastCueAt = 0;
    this.cuePresence = 0;
    this.cueCompliance = 1;
    this.cueComplianceSmooth = 1;
    this.cueFxSynth?.dispose();
    this.cueFxSynth = null;
    this.lastPlayedNoteName = "C4";
  }
}

const orchestraToneEngine = new OrchestraToneEngine();

export { orchestraToneEngine };
