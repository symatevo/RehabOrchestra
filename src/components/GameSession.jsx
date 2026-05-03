import { useEffect, useRef, useState } from "react";
import {
  cueActiveWindowEnd,
  cueMatchScore,
  cueMissDeadline,
  cueProgress,
  cueTravelSec,
} from "../data/cueTiming.js";
import { orchestraToneEngine } from "../audio/orchestraToneEngine.js";
import { useGameStore } from "../store/useGameStore.js";
import { playMissDuck } from "../audio/missFx.js";
import { ORCHESTRA_CHALLENGES, stepOrchestraChallenge } from "../level/orchestraChallenges.js";
import { nextPerformanceEnergy } from "../level/performanceEnergy.js";
import { CueOverlay } from "./CueOverlay.jsx";

export function GameSession() {
  const screen = useGameStore((s) => s.screen);
  const levelId = useGameStore((s) => s.levelId);
  const audioTime = useGameStore((s) => s.audioTime);
  const chart = useGameStore((s) => s.chart);
  const [active, setActive] = useState(
    /** @type {import('./CueOverlay.jsx').ActiveCue[]} */ ([])
  );
  const [countdownSec, setCountdownSec] = useState(0);
  const spawned = useRef(new Set());
  const raf = useRef(0);
  const timers = useRef(/** @type {number[]} */ ([]));
  const perfAtRef = useRef(0);
  const prevExpressionRef = useRef(0.5);
  const challengeRef = useRef({ index: 0, progress: 0, streak: 0 });
  const audioStartedRef = useRef(false);
  const lastSectionBloomRef = useRef(0);
  /** Hold cues: integrated match over hold window */
  const holdAccumRef = useRef(/** @type {Record<number, { good: number; total: number }>} */ ({}));
  /** Last time we pulsed sparkles during an active hold (per cue id). */
  const holdSparkleLastRef = useRef(/** @type {Record<number, number>} */ ({}));
  const HOLD_SPARKLE_INTERVAL_MS = 210;

  useEffect(() => {
    if (screen !== "playing") {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      setActive([]);
      setCountdownSec(0);
      spawned.current = new Set();
      holdAccumRef.current = {};
      holdSparkleLastRef.current = {};
      cancelAnimationFrame(raf.current);
      orchestraToneEngine.setCueCompliance(1);
      orchestraToneEngine.stopOrchestra();
      orchestraToneEngine.restartOrchestra();
      useGameStore.setState({ sessionMusicLive: false });
      return;
    }

    challengeRef.current = { index: 0, progress: 0, streak: 0 };
    audioStartedRef.current = false;
    perfAtRef.current = performance.now();
    holdAccumRef.current = {};
    holdSparkleLastRef.current = {};
    useGameStore.setState({
      orchestraChallengeIndex: 0,
      orchestraChallengeProgress01: 0,
      orchestraChallengeLabelKey: ORCHESTRA_CHALLENGES[0].labelKey,
      orchestraCueStreak: 0,
      performanceEnergy: 0,
      performanceGoalReached: false,
      sessionCueStreak: 0,
      butterflySpinPulseAt: 0,
      sessionMusicLive: false,
    });

    const noteSection = (instrument) =>
      instrument === "violin" || instrument === "string ensemble 1"
        ? "left"
        : instrument === "viola"
          ? "center"
          : "right";

    orchestraToneEngine.setLevel(levelId);
    orchestraToneEngine
      .initOrchestra()
      .then(() => {
        orchestraToneEngine.onNoteEvent((ev) => {
          useGameStore.getState().pulseOrchestraSection(
            noteSection(ev.instrument),
            ev.duration || 0,
            ev.instrument || "",
            ev.velocity || 0,
            !!ev.active
          );
          const now = performance.now();
          if (now - lastSectionBloomRef.current > 110) {
            useGameStore.getState().pulseBloom();
            lastSectionBloomRef.current = now;
          }
        });
        setCountdownSec(3);
        const a = window.setTimeout(() => setCountdownSec(2), 1000);
        const b = window.setTimeout(() => setCountdownSec(1), 2000);
        const c = window.setTimeout(() => {
          setCountdownSec(0);
          audioStartedRef.current = true;
          useGameStore.getState().setSessionMusicLive(true);
          orchestraToneEngine.startOrchestra();
        }, 3000);
        timers.current.push(a, b, c);
      })
      .catch(() => {});

    const removeCueVisual = (cueId, delayMs) => {
      const tid = window.setTimeout(() => {
        setActive((prev) => prev.filter((c) => c.id !== cueId));
        timers.current = timers.current.filter((x) => x !== tid);
      }, delayMs);
      timers.current.push(tid);
    };

    const loop = () => {
      if (useGameStore.getState().gamePaused) {
        perfAtRef.current = performance.now();
        raf.current = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const dt = Math.min(80, now - perfAtRef.current);
      const dtSec = dt / 1000;
      perfAtRef.current = now;

      const st = useGameStore.getState();
      const ch = st.chart;
      const t = audioStartedRef.current ? orchestraToneEngine.getTime() : 0;
      useGameStore.getState().setAudioTime(t);
      if (audioStartedRef.current) {
        const dur = orchestraToneEngine.getDuration();
        const u = dur > 0 ? Math.min(1, t / dur) : 0;
        orchestraToneEngine.updateSongProgress01(u);
      }

      let hitThisFrame = false;
      let missThisFrame = false;
      /** @type {null | 'perfect' | 'late'} */
      let hitKind = null;

      orchestraToneEngine.setExpression(st.handExpression01);
      orchestraToneEngine.setZone(st.handZoneIndex);
      orchestraToneEngine.setEnergy(st.performanceEnergy);

      for (const cue of ch) {
        if (spawned.current.has(cue.id)) continue;
        const travel = cueTravelSec(cue);
        if (audioStartedRef.current && t >= cue.hitTime - travel) {
          spawned.current.add(cue.id);
          if (cue.side === "both") useGameStore.getState().setMirrorUnlocked(true);
          setActive((prev) => [...prev, { ...cue }]);
        }
      }

      for (const cue of ch) {
        const kind = cue.kind ?? "close";
        if (kind !== "holdUp" && kind !== "holdDown") continue;
        if (useGameStore.getState().isCueResolved(cue.id)) continue;
        const holdDur = cue.holdSec ?? 0;
        if (t < cue.hitTime || t >= cue.hitTime + holdDur) continue;
        const m = cueMatchScore(cue, st.handExpression01, st.workingFist);
        const rec = holdAccumRef.current[cue.id] ?? { good: 0, total: 0 };
        rec.good += m * dtSec;
        rec.total += dtSec;
        holdAccumRef.current[cue.id] = rec;

        if (m >= 0.48) {
          const lastSp = holdSparkleLastRef.current[cue.id] ?? 0;
          if (now - lastSp >= HOLD_SPARKLE_INTERVAL_MS) {
            holdSparkleLastRef.current[cue.id] = now;
            useGameStore.getState().pulseHoldSparkles();
          }
        }
      }

      if (audioStartedRef.current && useGameStore.getState().consumeFistPulse()) {
        const hitT = t;
        const candidates = [];
        for (const cue of ch) {
          if (useGameStore.getState().isCueResolved(cue.id)) continue;
          if ((cue.kind ?? "close") !== "close") continue;
          const p = cueProgress(hitT, cue);
          if (p >= 0.62 && p <= 1.38) {
            candidates.push({ cue, p });
          }
        }
        if (candidates.length) {
          candidates.sort((a, b) => Math.abs(a.p - 1) - Math.abs(b.p - 1));
          const { cue: best, p } = candidates[0];
          useGameStore.getState().markCueResolved(best.id);
          const timing = p <= 1.08 ? "perfect" : "late";
          if (timing === "perfect") {
            useGameStore.getState().setFeedback("PERFECT");
            useGameStore.getState().addScore(100);
            useGameStore.getState().pulseBloom();
            useGameStore.getState().pulseGreatFx();
            orchestraToneEngine.registerCueResult("perfect");
            hitKind = "perfect";
          } else {
            useGameStore.getState().setFeedback("LATE");
            useGameStore.getState().addScore(48);
            orchestraToneEngine.registerCueResult("late");
            hitKind = "late";
          }
          hitThisFrame = true;
          useGameStore.getState().registerSessionCueHit();
          if (best.side === "both") useGameStore.getState().pulseMagic("hitBoth");
          else if (best.side === "left") useGameStore.getState().pulseMagic("hitL");
          else useGameStore.getState().pulseMagic("hitR");
          if (best.side === "left" || best.side === "both") useGameStore.getState().pulseSideHit("left");
          if (best.side === "right" || best.side === "both") useGameStore.getState().pulseSideHit("right");
          useGameStore.getState().pulseNoteBurst(best.side);
          useGameStore.getState().registerHit();
          setActive((prev) =>
            prev.map((c) => (c.id === best.id ? { ...c, pop: timing } : c))
          );
          removeCueVisual(best.id, 440);
        }
      }

      if (audioStartedRef.current) {
        for (const cue of ch) {
          if (useGameStore.getState().isCueResolved(cue.id)) continue;
          const kind = cue.kind ?? "close";
          if (kind === "holdUp" || kind === "holdDown") continue;
          if (kind === "close") continue;
          if (t < cue.hitTime - 0.3 || t > cue.hitTime + 0.48) continue;
          const m = cueMatchScore(cue, st.handExpression01, st.workingFist);
          if (m < 0.48) continue;
          useGameStore.getState().markCueResolved(cue.id);
          const timing = t <= cue.hitTime + 0.18 ? "perfect" : "late";
          if (timing === "perfect") {
            useGameStore.getState().setFeedback("PERFECT");
            useGameStore.getState().addScore(100);
            useGameStore.getState().pulseBloom();
            useGameStore.getState().pulseGreatFx();
            orchestraToneEngine.registerCueResult("perfect");
            hitKind = "perfect";
          } else {
            useGameStore.getState().setFeedback("LATE");
            useGameStore.getState().addScore(48);
            orchestraToneEngine.registerCueResult("late");
            hitKind = "late";
          }
          hitThisFrame = true;
          useGameStore.getState().registerSessionCueHit();
          if (cue.side === "both") useGameStore.getState().pulseMagic("hitBoth");
          else if (cue.side === "left") useGameStore.getState().pulseMagic("hitL");
          else useGameStore.getState().pulseMagic("hitR");
          if (cue.side === "left" || cue.side === "both") useGameStore.getState().pulseSideHit("left");
          if (cue.side === "right" || cue.side === "both") useGameStore.getState().pulseSideHit("right");
          useGameStore.getState().pulseNoteBurst(cue.side);
          useGameStore.getState().registerHit();
          setActive((prev) =>
            prev.map((c) => (c.id === cue.id ? { ...c, pop: timing } : c))
          );
          removeCueVisual(cue.id, 440);
        }
      }

      if (audioStartedRef.current) {
        for (const cue of ch) {
          if (useGameStore.getState().isCueResolved(cue.id)) continue;
          const kind = cue.kind ?? "close";
          if (kind !== "holdUp" && kind !== "holdDown") continue;
          const holdEnd = cue.hitTime + (cue.holdSec ?? 0);
          if (t < holdEnd) continue;
          const rec = holdAccumRef.current[cue.id];
          delete holdAccumRef.current[cue.id];
          delete holdSparkleLastRef.current[cue.id];
          const ratio = rec && rec.total > 0.05 ? rec.good / rec.total : 0;
          useGameStore.getState().markCueResolved(cue.id);
          if (ratio >= 0.42) {
            const timing = ratio >= 0.62 ? "perfect" : "late";
            if (timing === "perfect") {
              useGameStore.getState().setFeedback("PERFECT");
              useGameStore.getState().addScore(100);
              useGameStore.getState().pulseBloom();
              useGameStore.getState().pulseGreatFx();
              orchestraToneEngine.registerCueResult("perfect");
              hitKind = "perfect";
            } else {
              useGameStore.getState().setFeedback("LATE");
              useGameStore.getState().addScore(48);
              orchestraToneEngine.registerCueResult("late");
              hitKind = "late";
            }
            hitThisFrame = true;
            useGameStore.getState().registerSessionCueHit();
            if (cue.side === "both") useGameStore.getState().pulseMagic("hitBoth");
            else if (cue.side === "left") useGameStore.getState().pulseMagic("hitL");
            else useGameStore.getState().pulseMagic("hitR");
            if (cue.side === "left" || cue.side === "both") useGameStore.getState().pulseSideHit("left");
            if (cue.side === "right" || cue.side === "both") useGameStore.getState().pulseSideHit("right");
            useGameStore.getState().pulseNoteBurst(cue.side);
            useGameStore.getState().registerHit();
            setActive((prev) =>
              prev.map((c) => (c.id === cue.id ? { ...c, pop: timing } : c))
            );
            removeCueVisual(cue.id, 440);
          } else {
            useGameStore.getState().setFeedback("MISS");
            useGameStore.getState().registerMiss();
            useGameStore.getState().resetSessionCueStreak();
            playMissDuck();
            useGameStore.getState().pulseMissFx();
            orchestraToneEngine.registerCueResult("miss");
            missThisFrame = true;
            setActive((prev) =>
              prev.map((c) => (c.id === cue.id ? { ...c, pop: "miss" } : c))
            );
            removeCueVisual(cue.id, 360);
          }
        }
      }

      const exprDelta = Math.abs(st.handExpression01 - prevExpressionRef.current);
      prevExpressionRef.current = st.handExpression01;
      const nextEnergy = nextPerformanceEnergy({
        prevEnergy: st.performanceEnergy,
        dtMs: dt,
        expression01: st.handExpression01,
        expressionDeltaAbs: exprDelta,
        hitKind,
      });
      useGameStore.setState({
        performanceEnergy: nextEnergy,
        performanceGoalReached: nextEnergy >= 100,
      });

      for (const cue of ch) {
        if (useGameStore.getState().isCueResolved(cue.id)) continue;
        if (audioStartedRef.current && t > cueMissDeadline(cue)) {
          useGameStore.getState().markCueResolved(cue.id);
          useGameStore.getState().setFeedback("MISS");
          useGameStore.getState().registerMiss();
          useGameStore.getState().resetSessionCueStreak();
          playMissDuck();
          useGameStore.getState().pulseMissFx();
          orchestraToneEngine.registerCueResult("miss");
          missThisFrame = true;
          delete holdAccumRef.current[cue.id];
          delete holdSparkleLastRef.current[cue.id];
          setActive((prev) =>
            prev.map((c) => (c.id === cue.id ? { ...c, pop: "miss" } : c))
          );
          removeCueVisual(cue.id, 360);
        }
      }

      const next = stepOrchestraChallenge(challengeRef.current, {
        handExpression01: st.handExpression01,
        handZoneIndex: st.handZoneIndex,
        deltaMs: dt,
        hit: hitThisFrame,
        miss: missThisFrame,
      });
      challengeRef.current = {
        index: next.index,
        progress: next.progress ?? 0,
        streak: next.streak ?? challengeRef.current.streak,
      };
      useGameStore.setState({
        orchestraChallengeIndex: next.index,
        orchestraChallengeProgress01: next.progress01 ?? 1,
        orchestraChallengeLabelKey:
          ORCHESTRA_CHALLENGES[Math.min(next.index, ORCHESTRA_CHALLENGES.length - 1)]?.labelKey ??
          ORCHESTRA_CHALLENGES[ORCHESTRA_CHALLENGES.length - 1].labelKey,
        orchestraCueStreak: challengeRef.current.streak,
        orchestraGoalBonusClaimed: next.done,
      });
      if (next.progressed) useGameStore.getState().addScore(40);

      const last = ch[ch.length - 1];
      const lastMargin = last ? cueMissDeadline(last) + 0.85 : 0;
      const ended =
        audioStartedRef.current &&
        (orchestraToneEngine.isEnded() ||
          (ch.length === 0 && t > 1) ||
          (last && t > Math.max(orchestraToneEngine.getDuration(), lastMargin)));

      if (ended) {
        cancelAnimationFrame(raf.current);
        orchestraToneEngine.setCueCompliance(1);
        orchestraToneEngine.stopOrchestra();
        orchestraToneEngine.restartOrchestra();
        useGameStore.getState().endSession();
        useGameStore.setState({ sessionMusicLive: false });
        return;
      }

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      cancelAnimationFrame(raf.current);
      holdAccumRef.current = {};
      holdSparkleLastRef.current = {};
      orchestraToneEngine.setCueCompliance(1);
      orchestraToneEngine.stopOrchestra();
      orchestraToneEngine.restartOrchestra();
      useGameStore.setState({ sessionMusicLive: false });
    };
  }, [screen, levelId]);

  if (screen !== "playing") return null;

  return (
    <CueOverlay
      active={active}
      audioTime={audioTime}
      countdownSec={countdownSec}
      previewCues={countdownSec > 0 ? chart.slice(0, 2) : []}
    />
  );
}
