import { useGameStore } from "../../store/useGameStore.js";
import { t } from "../../i18n/strings.js";
import { getOrchestraMeta } from "../../data/orchestraTracks.js";
export function OrchestraLevelOverlay() {
  const locale = useGameStore((s) => s.locale);
  const screen = useGameStore((s) => s.screen);
  const handExpression01 = useGameStore((s) => s.handExpression01);
  const handZoneIndex = useGameStore((s) => s.handZoneIndex);
  const challengeProgress = useGameStore((s) => s.orchestraChallengeProgress01);
  const challengeLabelKey = useGameStore((s) => s.orchestraChallengeLabelKey);
  const done = useGameStore((s) => s.orchestraGoalBonusClaimed);
  const chart = useGameStore((s) => s.chart);
  const audioTime = useGameStore((s) => s.audioTime);
  const resolvedCueIds = useGameStore((s) => s.resolvedCueIds);
  const levelId = useGameStore((s) => s.levelId);
  if (screen !== "playing") return null;
  const total = chart.length || 1;
  const solved = Object.keys(resolvedCueIds).length;
  const duration = getOrchestraMeta(levelId).durationSec;
  const remain = Math.max(0, Math.ceil(duration - audioTime));
  const songProgress01 = Math.min(1, Math.max(0, audioTime / Math.max(0.001, duration)));
  const isFinishing = remain === 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-[35]">
      <div className="absolute left-3 top-3 rounded-md bg-slate-900/55 px-2 py-1 text-[10px] text-white/90 ring-1 ring-white/20">
        {t(locale, challengeLabelKey)}
      </div>

      <div className="absolute left-3 top-10 h-1 w-28 overflow-hidden rounded-full bg-white/20">
        <div
          className={`h-full transition-all ${done ? "bg-emerald-400" : "bg-sky-400"}`}
          style={{ width: `${Math.round(challengeProgress * 100)}%` }}
        />
      </div>

      <div className="absolute right-3 top-[22%] rounded-xl bg-black/45 px-2.5 py-2 ring-1 ring-cyan-200/25">
        <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-cyan-100/90">
          Conduct dynamics
        </div>
        <div className="mt-1 text-center text-[9px] text-white/70">{t(locale, "orchestraVolume")}</div>
        <div className="relative mx-auto mt-1.5 h-32 w-3 rounded-full bg-slate-900/55 p-0.5 ring-1 ring-white/25">
          <div
            className="absolute bottom-0.5 left-0.5 right-0.5 rounded-full bg-gradient-to-t from-emerald-800 to-emerald-300"
            style={{ height: `${Math.round(handExpression01 * 100)}%` }}
          />
          <div
            className="absolute -left-1.5 right-[-0.4rem] h-1.5 rounded-full bg-emerald-200/80 shadow-[0_0_14px_rgba(110,231,183,0.9)]"
            style={{ bottom: `${Math.round(handExpression01 * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-white/65">
          <span>soft</span>
          <span>strong</span>
        </div>
      </div>

      <div className="absolute top-2 left-1/2 w-[min(84vw,420px)] -translate-x-1/2 rounded-xl bg-black/55 px-4 py-2.5 text-center text-[12px] text-white/95 ring-1 ring-cyan-300/35">
        <div className="text-[11px] opacity-90">
          {solved}/{total} · {isFinishing ? t(locale, "finishing") : `${t(locale, "timeLeft")} ${remain}s`}
        </div>
        <div className="mt-1 text-[10px] opacity-75">{Math.round(songProgress01 * 100)}%</div>
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1">
        <span
          className={`h-2 w-2 rounded-full ${handZoneIndex === 0 ? "bg-cyan-400" : "bg-white/35"}`}
        />
        <span
          className={`h-2 w-2 rounded-full ${handZoneIndex === 1 ? "bg-cyan-400" : "bg-white/35"}`}
        />
        <span
          className={`h-2 w-2 rounded-full ${handZoneIndex === 2 ? "bg-cyan-400" : "bg-white/35"}`}
        />
      </div>
    </div>
  );
}
