import { Fragment } from "react";
import { useGameStore } from "../store/useGameStore.js";
import { cuePhase, cueTravelSec } from "../data/cueTiming.js";

const CX = 50;
/** Two parallel lanes in the middle (same logic, mirrored spacing). */
const LANE_OFFSET_PCT = 4.35;
const LANE_CX = [CX - LANE_OFFSET_PCT, CX + LANE_OFFSET_PCT];
const BASE_BOTTOM = "34%";
const RING_BOTTOM = "44%";

/** Target line where arrows land (bottom %); matches dashed ring band. */
const LAND_Y = 34;

/** Up / hold-up: start low on screen, move up toward ring (raise hands). */
const UP_FROM_BOTTOM = { start: 12, end: LAND_Y };
/** Down / hold-down: start high on screen, move down toward ring (lower hands). */
const DOWN_FROM_TOP = { start: 82, end: LAND_Y };

/** Shrinking fist cue matches this size at the hit (same as dashed ring). */
const RING_REM = 4.75;

/**
 * @typedef {import('../data/buildChart.js').CueKind} CueKind
 */

/**
 * @typedef {{ id: number; hitTime: number; side: 'left'|'right'|'both'; travel: number; kind?: CueKind; holdSec?: number; pop?: 'perfect'|'late'|'miss' }} ActiveCue
 */

/** @param {CueKind | undefined} kind */
function approachForKind(kind) {
  switch (kind) {
    case "up":
    case "holdUp":
      return UP_FROM_BOTTOM;
    case "down":
    case "holdDown":
      return DOWN_FROM_TOP;
    case "close":
      return null;
    default:
      return UP_FROM_BOTTOM;
  }
}

/** @param {CueKind | undefined} kind */
function cuePalette(kind) {
  switch (kind) {
    case "up":
    case "holdUp":
      return {
        fill: "bg-sky-500/95",
        ring: "ring-sky-200/90",
        label: "↑",
        labelCls: "text-[2.85rem] leading-none font-black",
      };
    case "down":
    case "holdDown":
      return {
        fill: "bg-violet-500/95",
        ring: "ring-violet-200/90",
        label: "↓",
        labelCls: "text-[2.85rem] leading-none font-black",
      };
    case "close":
      return {
        fill: "bg-teal-500/95",
        ring: "ring-white/80",
        label: "✊",
        labelCls: "text-[2.1rem] leading-none",
      };
    default:
      return {
        fill: "bg-teal-500/95",
        ring: "ring-white/80",
        label: "✊",
        labelCls: "text-[2.1rem] leading-none",
      };
  }
}

/**
 * @param {object} props
 * @param {ActiveCue[]} props.active
 * @param {number} props.audioTime
 * @param {number} [props.countdownSec]
 * @param {ActiveCue[]} [props.previewCues]
 */
function CueOverlay({ active, audioTime, countdownSec = 0, previewCues = [] }) {
  const fistFxAt = useGameStore((s) => s.fistFxAt);
  const fistFxVisible = (typeof performance !== "undefined" ? performance.now() : Date.now()) - fistFxAt < 360;

  const renderCloseCue = (cue, pTravelRaw, palette, laneX, laneKey) => {
    const p = Math.min(1, pTravelRaw);
    const scale = 2.35 - 1.35 * p;
    const fistPop =
      cue.pop === "perfect"
        ? "animate-cue-fist-pop-perfect"
        : cue.pop === "late"
          ? "animate-cue-fist-pop-late"
          : cue.pop === "miss"
            ? "animate-cue-fist-pop-miss"
            : "";

    return (
      <div
        key={`cue-${cue.id}-${laneKey}`}
        className="pointer-events-none absolute"
        style={{
          left: `${laneX}%`,
          bottom: RING_BOTTOM,
          transform: "translate(-50%, 50%)",
        }}
        aria-hidden
      >
        <div
          className={`flex origin-center items-center justify-center rounded-full border-[3px] shadow-lg ring-2 ${palette.ring} ${palette.fill} ${fistPop}`}
          style={{
            width: `${RING_REM}rem`,
            height: `${RING_REM}rem`,
            transform: `scale(${scale})`,
          }}
        >
          <span className={`drop-shadow ${palette.labelCls}`}>{palette.label}</span>
        </div>
      </div>
    );
  };

  const renderArrowCue = (
    cue,
    approach,
    travel,
    spawn,
    phase,
    pTravelRaw,
    palette,
    isHold,
    holdDur,
    hold01,
    end,
    popClass,
    laneX,
    laneKey
  ) => {
    const p = Math.min(1, pTravelRaw);
    const { start } = approach;
    const y = start + p * (end - start);

    const holdBars = (
      <span className="mt-1 flex items-end gap-1" aria-hidden>
        <span className="h-2.5 w-1 rounded-full bg-white/95" />
        <span className="h-4 w-1 rounded-full bg-white/95" />
        <span className="h-2.5 w-1 rounded-full bg-white/95" />
      </span>
    );

    const markerInner = (
      <>
        <span className={`drop-shadow ${palette.labelCls}`}>{palette.label}</span>
        {isHold && phase !== "idle" && holdBars}
      </>
    );

    const shapeCls = isHold
      ? `min-h-[4rem] min-w-[6.25rem] px-3 py-2.5 rounded-2xl animate-cue-hold-glow ${palette.fill} shadow-lg ring-[3px] ${palette.ring} ${popClass}`
      : `cue-marker flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-full ring-[3px] ${palette.fill} shadow-lg ${palette.ring} ${popClass}`;

    return (
      <Fragment key={`cue-${cue.id}-${laneKey}`}>
        <div
          className={`absolute flex flex-col items-center justify-center ${shapeCls}`}
          style={{
            left: `${laneX}%`,
            bottom: `calc(${y}% + 1.75rem)`,
            transform: "translateX(-50%)",
          }}
          aria-hidden
        >
          {markerInner}
        </div>
        {isHold && phase === "hold" && (
          <>
            <div
              className="pointer-events-none absolute rounded-full border-[3px] border-amber-200/90 bg-amber-400/15 animate-cue-hold-ring"
              style={{
                left: `${laneX}%`,
                bottom: `calc(${end}% + 1.75rem)`,
                width: "6.75rem",
                height: "6.75rem",
                transform: "translate(-50%, 0)",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute overflow-hidden rounded-full bg-black/35"
              style={{
                left: `${laneX}%`,
                bottom: `calc(${end - 6}% + 1.75rem)`,
                width: "5rem",
                height: "0.4rem",
                transform: "translateX(-50%)",
              }}
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-amber-300"
                style={{ width: `${(1 - hold01) * 100}%`, transition: "width 80ms linear" }}
              />
            </div>
          </>
        )}
      </Fragment>
    );
  };

  const renderCenterCue = (cue, laneX, laneKey) => {
    const travel = cueTravelSec(cue);
    const spawn = cue.hitTime - travel;
    const phase = cuePhase(audioTime, cue);
    const approach = approachForKind(cue.kind);
    let pTravelRaw;
    if (phase === "hold") {
      pTravelRaw = 1;
    } else {
      pTravelRaw = Math.min(1.12, Math.max(0, (audioTime - spawn) / travel));
    }

    const palette = cuePalette(cue.kind);
    const isHold = cue.kind === "holdUp" || cue.kind === "holdDown";
    const holdDur = cue.holdSec ?? 0;
    const hold01 =
      isHold && phase === "hold" && holdDur > 0
        ? Math.min(1, Math.max(0, (audioTime - cue.hitTime) / holdDur))
        : 0;

    const popClass =
      cue.pop === "perfect"
        ? "animate-cue-pop-perfect"
        : cue.pop === "late"
          ? "animate-cue-pop-late"
          : cue.pop === "miss"
            ? "animate-cue-pop-miss"
            : "";

    if (cue.kind === "close" || !approach) {
      return renderCloseCue(cue, pTravelRaw, palette, laneX, laneKey);
    }

    const { end } = approach;
    return renderArrowCue(
      cue,
      approach,
      travel,
      spawn,
      phase,
      pTravelRaw,
      palette,
      isHold,
      holdDur,
      hold01,
      end,
      popClass,
      laneX,
      laneKey
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[50]">
      {LANE_CX.map((laneX, laneIdx) => (
        <Fragment key={`lane-bg-${laneIdx}`}>
          <div
            className="absolute w-0.5 bg-gradient-to-t from-sky-400/90 via-sky-200/70 to-transparent"
            style={{
              left: `${laneX}%`,
              bottom: BASE_BOTTOM,
              height: "min(38vh, 300px)",
              transform: "translateX(-50%)",
            }}
          />
          <div
            className="absolute box-border h-[4.75rem] w-[4.75rem] rounded-full border-2 border-dashed border-sky-100/95 bg-white/10 shadow-[0_0_30px_rgba(56,189,248,0.42)]"
            style={{
              left: `${laneX}%`,
              bottom: RING_BOTTOM,
              transform: "translate(-50%, 50%)",
            }}
          />
        </Fragment>
      ))}

      {LANE_CX.flatMap((laneX, laneIdx) =>
        previewCues.map((cue) => {
          const travel = cueTravelSec(cue);
          const p = Math.min(1, Math.max(0, (audioTime - (cue.hitTime - travel)) / travel));
          const ap = approachForKind(cue.kind);
          const lk = `l${laneIdx}`;
          if (!ap) {
            const scale = 2.35 - 1.35 * p;
            return (
              <div
                key={`ghost-${cue.id}-${lk}`}
                className="absolute rounded-full border-2 border-teal-300/45 bg-teal-400/15"
                style={{
                  left: `${laneX}%`,
                  bottom: RING_BOTTOM,
                  width: `${RING_REM}rem`,
                  height: `${RING_REM}rem`,
                  transform: `translate(-50%, 50%) scale(${scale})`,
                }}
              />
            );
          }
          const { start, end } = ap;
          const y = start + p * (end - start);
          return (
            <div
              key={`ghost-${cue.id}-${lk}`}
              className="absolute h-11 w-11 rounded-full border border-cyan-200/50 bg-cyan-200/10"
              style={{
                left: `${laneX}%`,
                bottom: `calc(${y}% + 1.6rem)`,
                transform: "translateX(-50%)",
              }}
            />
          );
        })
      )}

      {LANE_CX.flatMap((laneX, laneIdx) =>
        active.map((cue) => renderCenterCue(cue, laneX, `l${laneIdx}`))
      )}

      {LANE_CX.flatMap((laneX, laneIdx) =>
        active.flatMap((cue) => {
          if (!cue.pop) return [];
          const burst = [];
          const lk = `l${laneIdx}`;
          if (cue.pop === "perfect") {
            burst.push(
              <div
                key={`shock-${cue.id}-${lk}`}
                className="absolute bottom-[44%] h-20 w-20 rounded-full border border-cyan-100/90 animate-hit-shockwave"
                style={{ left: `${laneX}%`, transform: "translateX(-50%)" }}
              />
            );
            for (let i = 0; i < 8; i += 1) {
              burst.push(
                <span
                  key={`particle-${cue.id}-${lk}-${i}`}
                  className="absolute bottom-[44%] block h-2 w-2 rounded-full bg-cyan-200/95 animate-hit-particle"
                  style={{
                    left: `${laneX}%`,
                    transform: "translateX(-50%)",
                    ["--p-angle"]: `${i * 45}deg`,
                    ["--p-dist"]: `${22 + i * 3}px`,
                  }}
                />
              );
            }
          }
          return burst;
        })
      )}

      {fistFxVisible &&
        LANE_CX.map((laneX, laneIdx) => (
          <Fragment key={`fistfx-${laneIdx}`}>
            <div
              className="absolute bottom-[44%] h-14 w-14 rounded-full border border-amber-200/90 animate-fist-flash"
              style={{ left: `${laneX}%`, transform: "translateX(-50%)" }}
            />
            <div
              className="absolute bottom-[44%] h-9 w-9 rounded-full bg-amber-300/40 blur-sm animate-fist-core"
              style={{ left: `${laneX}%`, transform: "translateX(-50%)" }}
            />
          </Fragment>
        ))}

      {countdownSec > 0 && (
        <div className="absolute left-1/2 top-[42%] -translate-x-1/2 rounded-full bg-black/55 px-7 py-4 text-5xl font-black text-cyan-200 shadow-[0_0_36px_rgba(56,189,248,0.65)] ring-1 ring-cyan-200/40">
          {countdownSec}
        </div>
      )}
    </div>
  );
}

export { CueOverlay };
