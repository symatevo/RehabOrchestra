import { useEffect, useState } from "react";
import { GameScene } from "./components/GameScene.jsx";
import { CameraWidget } from "./components/CameraWidget.jsx";
import { GameSession } from "./components/GameSession.jsx";
import { SessionProgressBar } from "./components/SessionProgressBar.jsx";
import { ResultsRoseRain } from "./components/ResultsRoseRain.jsx";
import { ConductorMagicOverlay } from "./components/level/ConductorMagicOverlay.jsx";
import { CelloOrchestraOverlay } from "./components/level/InstrumentSpritePlayer.jsx";
import { ViolinOrchestraOverlay } from "./components/level/ViolinSpritePlayer.jsx";
import { OrchestraLevelOverlay } from "./components/level/OrchestraLevelOverlay.jsx";
import { useGameStore } from "./store/useGameStore.js";
import { t } from "./i18n/strings.js";
import { orchestraToneEngine } from "./audio/orchestraToneEngine.js";
import { resumeAudioContext } from "./audio/missFx.js";
import { publicUrl } from "./utils/publicUrl.js";

/** Resolved with publicUrl so GitHub Pages /repo/ works without a trailing slash on the URL. */
const TUTORIAL_VIDEO_SRC = publicUrl("video/Tutorial.mp4");

function PauseOverlay() {
  const locale = useGameStore((s) => s.locale);
  const gamePaused = useGameStore((s) => s.gamePaused);
  const screen = useGameStore((s) => s.screen);
  const requestResumeFromPause = useGameStore((s) => s.requestResumeFromPause);

  if (!gamePaused || screen !== "playing") return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[950] flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/25 bg-slate-900/90 px-8 py-6 shadow-xl">
        <p className="text-lg font-semibold text-white">{t(locale, "gamePausedTitle")}</p>
        <button
          type="button"
          onClick={() => {
            orchestraToneEngine.resumeGameTransport();
            requestResumeFromPause();
          }}
          className="rounded-full bg-sky-600 px-8 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
        >
          {t(locale, "resumeGame")}
        </button>
      </div>
    </div>
  );
}

function FeedbackToast() {
  const locale = useGameStore((s) => s.locale);
  const lastFeedback = useGameStore((s) => s.lastFeedback);
  const feedbackAt = useGameStore((s) => s.feedbackAt);

  useEffect(() => {
    if (!lastFeedback) return;
    const id = window.setTimeout(() => {
      useGameStore.setState({ lastFeedback: null });
    }, 900);
    return () => window.clearTimeout(id);
  }, [lastFeedback, feedbackAt]);

  if (!lastFeedback) return null;

  const label =
    lastFeedback === "PERFECT"
      ? t(locale, "perfect")
      : lastFeedback === "LATE"
        ? t(locale, "late")
        : t(locale, "miss");

  const tone =
    lastFeedback === "PERFECT"
      ? "bg-emerald-500/95 text-white"
      : lastFeedback === "LATE"
        ? "bg-amber-500/95 text-white"
        : "bg-rose-600/95 text-white";
  const icon = lastFeedback === "PERFECT" ? "✦" : lastFeedback === "LATE" ? "◔" : "✕";
  const feedbackClass =
    lastFeedback === "PERFECT"
      ? "hit-feedback--great animate-feedback-great"
      : lastFeedback === "LATE"
        ? "animate-feedback-late"
        : "animate-feedback-miss";

  return (
    <div
      className={`hit-feedback fixed left-1/2 top-[70%] z-[200] -translate-x-1/2 rounded-full px-6 py-2 text-center text-sm font-semibold shadow-lg ${tone} ${
        feedbackClass
      }`}
    >
      <span className="mr-2 inline-block text-base">{icon}</span>
      {label}
    </div>
  );
}

function SetupScreen() {
  const locale = useGameStore((s) => s.locale);
  const setLocale = useGameStore((s) => s.setLocale);
  const damagedSide = useGameStore((s) => s.damagedSide);
  const setDamagedSide = useGameStore((s) => s.setDamagedSide);
  const startPlaying = useGameStore((s) => s.startPlaying);
  const lobbyCameraReady = useGameStore((s) => s.lobbyCameraReady);
  const [startPending, setStartPending] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [loadPct, setLoadPct] = useState(0);

  const canStart = !!damagedSide && lobbyCameraReady;

  useEffect(() => {
    if (!damagedSide) {
      setLoadPct(0);
      return;
    }
    if (lobbyCameraReady) {
      setLoadPct(100);
      return;
    }
    setLoadPct(0);
    let raf = 0;
    const t0 = performance.now();
    const capMs = 1750;
    const tick = () => {
      if (useGameStore.getState().lobbyCameraReady) {
        setLoadPct(100);
        return;
      }
      const t = performance.now() - t0;
      setLoadPct(Math.min(92, (t / capMs) * 92));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [damagedSide, lobbyCameraReady]);

  return (
    <section className="pointer-events-auto absolute inset-0 z-[60] flex h-full flex-col px-4 pt-[2vh]">
      {tutorialOpen && (
        <div className="pointer-events-auto fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/45 p-4 pb-10 sm:items-center sm:pb-4">
          <div className="relative w-full max-w-[min(440px,72vw)] overflow-hidden rounded-xl border border-white/25 bg-slate-900/95 shadow-2xl">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white transition hover:bg-white/25"
              aria-label="Close"
              onClick={() => {
                setTutorialOpen(false);
                startPlaying();
              }}
            >
              ×
            </button>
            <p className="px-3 pt-2 text-center text-[11px] text-white/80">{t(locale, "tutorialHint")}</p>
            <video
              className="w-full max-h-[min(44vh,320px)] bg-black object-contain"
              src={TUTORIAL_VIDEO_SRC}
              controls
              playsInline
              autoPlay
              muted
            />
          </div>
        </div>
      )}
      <div className="absolute top-4 right-4 z-[61] flex gap-2">
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            locale === "en" ? "bg-sky-600 text-white" : "bg-white/70 text-slate-700"
          }`}
        >
          {t(locale, "langEn")}
        </button>
        <button
          type="button"
          onClick={() => setLocale("hy")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            locale === "hy" ? "bg-sky-600 text-white" : "bg-white/70 text-slate-700"
          }`}
        >
          {t(locale, "langHy")}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl shrink-0 pt-2 text-center">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-800 md:text-3xl">
          {t(locale, "title")}
        </h1>
        <p className="text-sm text-slate-600 md:text-[15px]">{t(locale, "subtitle")}</p>
      </div>

      {/* Wide lobby: toggles at far left / far right (avatar shows in the middle on the canvas) */}
      <div className="relative flex min-h-0 w-full flex-1 items-center">
        <div className="pointer-events-auto absolute inset-0 mx-auto flex max-w-[min(100%,800px)] items-center justify-between px-3 sm:px-8 md:px-14 lg:px-24 xl:px-32">
          <button
            type="button"
            className="flex shrink-0 flex-col items-center gap-3 text-slate-800"
            onClick={() => setDamagedSide("right")}
          >
            <span className="text-base font-semibold tracking-wide md:text-lg">
              {t(locale, "right")}
            </span>
            <span
              className={`relative h-9 w-16 rounded-full transition-colors ${
                damagedSide === "right" ? "bg-sky-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  damagedSide === "right" ? "translate-x-7" : ""
                }`}
              />
            </span>
          </button>
          <button
            type="button"
            className="flex shrink-0 flex-col items-center gap-3 text-slate-800"
            onClick={() => setDamagedSide("left")}
          >
            <span className="text-base font-semibold tracking-wide md:text-lg">
              {t(locale, "left")}
            </span>
            <span
              className={`relative h-9 w-16 rounded-full transition-colors ${
                damagedSide === "left" ? "bg-sky-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  damagedSide === "left" ? "translate-x-7" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="relative mt-auto mb-8 flex max-sm:mb-20 max-sm:z-[1010] shrink-0 flex-col items-center gap-3">
        
        {damagedSide && !lobbyCameraReady && (
          <div className="w-full max-w-xs">
            <p className="mb-1 text-center text-[11px] text-slate-600">{t(locale, "loadingCamera")}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-600 transition-[width] duration-100 ease-out"
                style={{ width: `${loadPct}%` }}
              />
            </div>
          </div>
        )}
        {!damagedSide && (
          <p className="text-center text-xs text-amber-700">{t(locale, "needLimb")}</p>
        )}
        <button
          type="button"
          disabled={!canStart || startPending}
          onClick={async () => {
            if (!canStart || startPending) return;
            setStartPending(true);
            try {
              await resumeAudioContext();
              await new Promise((r) => setTimeout(r, 150));
              setTutorialOpen(true);
            } catch {
              /* keep setup */
            } finally {
              setStartPending(false);
            }
          }}
          className="pointer-events-auto rounded-full bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {t(locale, "startGame")}
        </button>
      </div>
    </section>
  );
}

function ResultsScreen() {
  const locale = useGameStore((s) => s.locale);
  const score = useGameStore((s) => s.score);
  const hits = useGameStore((s) => s.hits);
  const misses = useGameStore((s) => s.misses);
  const resetRound = useGameStore((s) => s.resetRound);
  const setScreen = useGameStore((s) => s.setScreen);

  const resolved = hits + misses;
  const accuracyPct = resolved > 0 ? Math.round((hits / resolved) * 100) : 100;
  useEffect(() => {
    const audio = new Audio(publicUrl("audio/applause.mp3"));
    audio.volume = 0.88;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  return (
    <section className="pointer-events-auto absolute inset-0 z-[70] flex flex-col items-center justify-center bg-slate-900/78 px-6 text-white backdrop-blur-sm">
      <ResultsRoseRain />
      <div className="relative z-[73] flex flex-col items-center text-center">
        <h2 className="mb-4 text-xl font-semibold">{t(locale, "resultsTitle")}</h2>
        <p className="mb-2 text-lg font-semibold text-sky-200 tabular-nums">
          {t(locale, "resultsAccuracy").replace("{pct}", String(accuracyPct))}
        </p>
        <p className="mb-1 text-4xl font-bold tabular-nums">{score}</p>
        <p className="mb-6 text-sm opacity-80">
          {t(locale, "score")} · {hits} ✓ · {misses} ✕
        </p>
        <button
          type="button"
          onClick={() => {
            resetRound();
            setScreen("setup");
          }}
          className="rounded-full bg-sky-500 px-8 py-3 text-sm font-semibold hover:bg-sky-400"
        >
          {t(locale, "playAgain")}
        </button>
      </div>
    </section>
  );
}

function ScreenFxOverlay() {
  const greatFxAt = useGameStore((s) => s.greatFxAt);
  const [, setFxFrame] = useState(0);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const greatLife = Math.max(0, 1 - (now - greatFxAt) / 320);
      setFxFrame((n) => n + 1);
      if (greatLife > 0) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [greatFxAt]);

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const greatLife = Math.max(0, 1 - (now - greatFxAt) / 320);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[34] mix-blend-screen"
      style={{
        background: `radial-gradient(ellipse at center, rgba(103,232,249,${greatLife * 0.24}) 0%, rgba(244,114,182,0) 55%)`,
        opacity: greatLife,
        transition: "opacity 120ms linear",
      }}
      aria-hidden
    />
  );
}

export default function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div
      className={`app-bg relative h-full w-full${screen === "setup" ? " app-bg--lobby" : ""}`}
    >
      <GameScene />
      {screen === "playing" && <ScreenFxOverlay />}
      {screen === "playing" && <ViolinOrchestraOverlay />}
      {screen === "playing" && <CelloOrchestraOverlay />}
      {screen === "playing" && <OrchestraLevelOverlay />}
      {screen === "playing" && <ConductorMagicOverlay />}
      {screen === "playing" && <SessionProgressBar />}
      <GameSession />
      <CameraWidget />
      <PauseOverlay />
      <FeedbackToast />
      {screen === "setup" && <SetupScreen />}
      {screen === "results" && <ResultsScreen />}
    </div>
  );
}
