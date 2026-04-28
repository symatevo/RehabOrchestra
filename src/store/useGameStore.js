import { create } from "zustand";
import { assertChartValid, buildCueChart } from "../data/buildChart.js";
import {
  DEFAULT_VRM_AVATAR_INDEX,
  VRM_AVATAR_FILES,
} from "../data/avatars.js";
import { publicUrl } from "../utils/publicUrl.js";

/** @typedef {'en' | 'hy'} Locale */
/** @typedef {'left' | 'right'} Side */
/** @typedef {'setup' | 'playing' | 'results'} Screen */

export const MUSIC_SRC = publicUrl("music/game.mp3");

export const useGameStore = create((set, get) => ({
  levelId: "level1",
  setLevelId: (levelId) => set({ levelId }),

  locale: /** @type {Locale} */ ("en"),
  setLocale: (locale) => set({ locale }),

  damagedSide: /** @type {Side | null} */ (null),
  setDamagedSide: (side) => set({ damagedSide: side, lobbyCameraReady: false }),

  avatarIndex: DEFAULT_VRM_AVATAR_INDEX,
  avatarFile: VRM_AVATAR_FILES[DEFAULT_VRM_AVATAR_INDEX],
  cycleAvatar: () => {
    const next = (get().avatarIndex + 1) % VRM_AVATAR_FILES.length;
    set({
      avatarIndex: next,
      avatarFile: VRM_AVATAR_FILES[next],
    });
  },
  cycleAvatarPrev: () => {
    const len = VRM_AVATAR_FILES.length;
    const next = (get().avatarIndex - 1 + len) % len;
    set({
      avatarIndex: next,
      avatarFile: VRM_AVATAR_FILES[next],
    });
  },
  cycleLevel: () => {
    const order = ["level1", "level2", "level3", "level4"];
    const i = order.indexOf(get().levelId);
    const next = order[(i >= 0 ? i + 1 : 0) % order.length];
    set({ levelId: next });
  },

  screen: /** @type {Screen} */ ("setup"),
  setScreen: (screen) => set({ screen }),

  /** True after Mediapipe lobby pipeline produced at least one frame (enables Start). */
  lobbyCameraReady: false,
  setLobbyCameraReady: (lobbyCameraReady) => set({ lobbyCameraReady }),

  /** Orchestra running (after countdown); camera-off pauses only when true. */
  sessionMusicLive: false,
  setSessionMusicLive: (sessionMusicLive) => set({ sessionMusicLive }),

  setGamePaused: (gamePaused) => set({ gamePaused }),
  cameraResumeNonce: 0,
  requestResumeFromPause: () =>
    set((s) => ({
      gamePaused: false,
      cameraResumeNonce: s.cameraResumeNonce + 1,
    })),

  videoElement: null,
  setVideoElement: (videoElement) => set({ videoElement }),

  resultsCallback: null,
  setResultsCallback: (resultsCallback) => set({ resultsCallback }),

  /** First chart row that uses `both` — unlock damaged-side mirror on avatar */
  unlockMirrorAfterCueIndex: 2,

  /** Cue index in chart for which damaged-side visuals unlock (first `both`) */
  mirrorUnlocked: false,
  setMirrorUnlocked: (v) => set({ mirrorUnlocked: v }),

  chart: /** @type {import('../data/buildChart.js').CueDef[]} */ ([]),
  rebuildChart: () => {
    const d = get().damagedSide;
    if (!d) return;
    const chart = buildCueChart(d, get().levelId);
    assertChartValid(d, chart);
    set({ chart });
  },

  score: 0,
  hits: 0,
  misses: 0,
  addScore: (points) => set((s) => ({ score: s.score + points })),
  registerHit: () => set((s) => ({ hits: s.hits + 1 })),
  registerMiss: () => set((s) => ({ misses: s.misses + 1 })),

  /** @type {'PERFECT' | 'LATE' | 'MISS' | null} */
  lastFeedback: null,
  feedbackAt: 0,
  setFeedback: (lastFeedback) =>
    set({ lastFeedback, feedbackAt: typeof performance !== "undefined" ? performance.now() : 0 }),

  /** cue id -> normalized progress 0..1 toward hit line (for active only) */
  cueProgressById: {},
  setCueProgress: (id, progress) =>
    set((s) => ({
      cueProgressById: { ...s.cueProgressById, [id]: progress },
    })),
  removeCueProgress: (id) =>
    set((s) => {
      const next = { ...s.cueProgressById };
      delete next[id];
      return { cueProgressById: next };
    }),

  resolvedCueIds: /** @type {Record<number, true>} */ ({}),
  markCueResolved: (id) =>
    set((s) => ({
      resolvedCueIds: { ...s.resolvedCueIds, [id]: true },
    })),
  isCueResolved: (id) => !!get().resolvedCueIds[id],

  /** Smoothed 0..1 from wrist height while playing (semi-conductor-style expression → MP3 volume) */
  handExpression01: 0.5,
  setHandExpression01: (handExpression01) => set({ handExpression01 }),

  /** 0 = left third, 1 = center, 2 = right third of frame (wrist midpoint x) */
  handZoneIndex: /** @type {0 | 1 | 2} */ (1),
  setHandZoneIndex: (handZoneIndex) =>
    set({ handZoneIndex: /** @type {0 | 1 | 2} */ (Math.min(2, Math.max(0, handZoneIndex | 0))) }),

  /** Miss duck: multiply expression-based volume (see missFx.playMissDuck) */
  musicDuckMultiplier: 1,
  setMusicDuckMultiplier: (musicDuckMultiplier) => set({ musicDuckMultiplier }),

  /** Orchestra goal: ms accumulated with hands high (expression > threshold) */
  orchestraGoalHandsUpMs: 0,
  setOrchestraGoalHandsUpMs: (orchestraGoalHandsUpMs) => set({ orchestraGoalHandsUpMs }),
  orchestraGoalBonusClaimed: false,
  setOrchestraGoalBonusClaimed: (orchestraGoalBonusClaimed) =>
    set({ orchestraGoalBonusClaimed }),

  /** Note pulses by orchestra section for 3D animation sync */
  orchestraSectionPulseAt: { left: 0, center: 0, right: 0 },
  /** Latest note info by section: { at, duration, instrument, velocity, active, seq } */
  orchestraSectionLastNote: {
    left: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
    center: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
    right: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
  },
  orchestraLowStringSeq: 0,
  orchestraHighStringSeq: 0,
  pulseOrchestraSection: (section, duration = 0, instrument = "", velocity = 0, active = false) =>
    set((s) => {
      const at =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const lowString = instrument === "cello" || instrument === "contrabass";
      const highString = instrument === "violin" || instrument === "viola" || instrument === "string ensemble 1";
      const nextLowSeq = lowString ? s.orchestraLowStringSeq + 1 : s.orchestraLowStringSeq;
      const nextHighSeq = highString ? s.orchestraHighStringSeq + 1 : s.orchestraHighStringSeq;
      const seq = lowString ? nextLowSeq : highString ? nextHighSeq : 0;
      return {
        orchestraLowStringSeq: nextLowSeq,
        orchestraHighStringSeq: nextHighSeq,
        orchestraSectionPulseAt: {
          ...s.orchestraSectionPulseAt,
          [section]: at,
        },
        orchestraSectionLastNote: {
          ...s.orchestraSectionLastNote,
          [section]: { at, duration, instrument, velocity, active, seq },
        },
      };
    }),

  /** Minimal challenge state for play mode */
  orchestraChallengeIndex: 0,
  setOrchestraChallengeIndex: (orchestraChallengeIndex) => set({ orchestraChallengeIndex }),
  orchestraChallengeProgress01: 0,
  setOrchestraChallengeProgress01: (orchestraChallengeProgress01) =>
    set({ orchestraChallengeProgress01 }),
  orchestraChallengeLabelKey: "orchestraChallengeRaise",
  setOrchestraChallengeLabelKey: (orchestraChallengeLabelKey) =>
    set({ orchestraChallengeLabelKey }),
  orchestraCueStreak: 0,
  setOrchestraCueStreak: (orchestraCueStreak) => set({ orchestraCueStreak }),

  /** Juicy objective: fill 0..100 from hits + expressive movement */
  performanceEnergy: 0,
  setPerformanceEnergy: (performanceEnergy) =>
    set({ performanceEnergy: Math.max(0, Math.min(100, performanceEnergy)) }),
  performanceGoalReached: false,
  setPerformanceGoalReached: (performanceGoalReached) => set({ performanceGoalReached }),

  /** Contextual magical trail pulses */
  magicPulseAt: { up: 0, down: 0, close: 0, hitL: 0, hitR: 0, hitBoth: 0 },
  pulseMagic: (kind) =>
    set((s) => ({
      magicPulseAt: {
        ...s.magicPulseAt,
        [kind]: typeof performance !== "undefined" ? performance.now() : Date.now(),
      },
    })),
  bloomPulseAt: 0,
  pulseBloom: () => set({ bloomPulseAt: typeof performance !== "undefined" ? performance.now() : Date.now() }),
  missFxAt: 0,
  pulseMissFx: () => set({ missFxAt: typeof performance !== "undefined" ? performance.now() : Date.now() }),
  greatFxAt: 0,
  pulseGreatFx: () => set({ greatFxAt: typeof performance !== "undefined" ? performance.now() : Date.now() }),
  sideHitAt: { left: 0, right: 0 },
  pulseSideHit: (side) =>
    set((s) => ({
      sideHitAt: {
        ...s.sideHitAt,
        [side]: typeof performance !== "undefined" ? performance.now() : Date.now(),
      },
    })),
  noteBurstAt: { left: 0, right: 0, both: 0 },
  pulseNoteBurst: (side) =>
    set((s) => ({
      noteBurstAt: {
        ...s.noteBurstAt,
        [side]: typeof performance !== "undefined" ? performance.now() : Date.now(),
      },
    })),

  /** Consecutive successful cue hits (perfect/late); drives session butterflies */
  sessionCueStreak: 0,
  butterflySpinPulseAt: 0,
  registerSessionCueHit: () =>
    set((s) => ({
      sessionCueStreak: s.sessionCueStreak + 1,
      butterflySpinPulseAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    })),
  /** Sparkle burst only (e.g. during hold) — does not increment streak. */
  pulseHoldSparkles: () =>
    set({
      butterflySpinPulseAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    }),
  resetSessionCueStreak: () => set({ sessionCueStreak: 0 }),

  /** Fist edge detection — working hand only (set from Holistic callback) */
  workingFist: false,
  setWorkingFist: (workingFist) => set({ workingFist }),

  /** One-shot rising edge for hit resolution */
  fistPulse: false,
  pulseFist: () => set({ fistPulse: true }),
  fistFxAt: 0,
  pulseFistFx: () =>
    set({ fistFxAt: typeof performance !== "undefined" ? performance.now() : Date.now() }),
  /** @returns {boolean} */
  consumeFistPulse: () => {
    if (!get().fistPulse) return false;
    set({ fistPulse: false });
    return true;
  },

  audioTime: 0,
  setAudioTime: (audioTime) => set({ audioTime }),

  resetRound: () =>
    set({
      score: 0,
      hits: 0,
      misses: 0,
      lastFeedback: null,
      cueProgressById: {},
      resolvedCueIds: {},
      mirrorUnlocked: false,
      workingFist: false,
      fistPulse: false,
      fistFxAt: 0,
      audioTime: 0,
      handExpression01: 0.5,
      handZoneIndex: 1,
      musicDuckMultiplier: 1,
      orchestraGoalHandsUpMs: 0,
      orchestraGoalBonusClaimed: false,
      orchestraSectionPulseAt: { left: 0, center: 0, right: 0 },
      orchestraSectionLastNote: {
        left: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
        center: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
        right: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
      },
      orchestraLowStringSeq: 0,
      orchestraHighStringSeq: 0,
      orchestraChallengeIndex: 0,
      orchestraChallengeProgress01: 0,
      orchestraChallengeLabelKey: "orchestraChallengeRaise",
      orchestraCueStreak: 0,
      performanceEnergy: 0,
      performanceGoalReached: false,
      magicPulseAt: { up: 0, down: 0, close: 0, hitL: 0, hitR: 0, hitBoth: 0 },
      bloomPulseAt: 0,
      missFxAt: 0,
      greatFxAt: 0,
      sideHitAt: { left: 0, right: 0 },
      noteBurstAt: { left: 0, right: 0, both: 0 },
      sessionCueStreak: 0,
      butterflySpinPulseAt: 0,
      gamePaused: false,
      lobbyCameraReady: false,
      sessionMusicLive: false,
    }),

  startPlaying: () => {
    get().rebuildChart();
    set({
      screen: "playing",
      gamePaused: false,
      sessionMusicLive: false,
      mirrorUnlocked: false,
      resolvedCueIds: {},
      cueProgressById: {},
      score: 0,
      hits: 0,
      misses: 0,
      lastFeedback: null,
      fistFxAt: 0,
      handExpression01: 0.5,
      handZoneIndex: 1,
      musicDuckMultiplier: 1,
      orchestraGoalHandsUpMs: 0,
      orchestraGoalBonusClaimed: false,
      orchestraSectionPulseAt: { left: 0, center: 0, right: 0 },
      orchestraSectionLastNote: {
        left: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
        center: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
        right: { at: 0, duration: 0, instrument: "", velocity: 0, active: false, seq: 0 },
      },
      orchestraLowStringSeq: 0,
      orchestraHighStringSeq: 0,
      orchestraChallengeIndex: 0,
      orchestraChallengeProgress01: 0,
      orchestraChallengeLabelKey: "orchestraChallengeRaise",
      orchestraCueStreak: 0,
      performanceEnergy: 0,
      performanceGoalReached: false,
      magicPulseAt: { up: 0, down: 0, close: 0, hitL: 0, hitR: 0, hitBoth: 0 },
      bloomPulseAt: 0,
      missFxAt: 0,
      greatFxAt: 0,
      sideHitAt: { left: 0, right: 0 },
      noteBurstAt: { left: 0, right: 0, both: 0 },
      sessionCueStreak: 0,
      butterflySpinPulseAt: 0,
    });
  },

  endSession: () => set({ screen: "results" }),
}));
