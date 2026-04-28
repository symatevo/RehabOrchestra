export const ORCHESTRA_CHALLENGES = [
  { id: "raise", labelKey: "orchestraChallengeRaise", targetMs: 2600 },
  { id: "center", labelKey: "orchestraChallengeCenter", targetMs: 2300 },
  { id: "streak", labelKey: "orchestraChallengeStreak", targetCount: 4 },
];

/**
 * @param {{index:number;progress:number;streak:number}} state
 * @param {{handExpression01:number;handZoneIndex:0|1|2;deltaMs:number;hit:boolean;miss:boolean}} input
 */
export function stepOrchestraChallenge(state, input) {
  const cur = ORCHESTRA_CHALLENGES[state.index];
  if (!cur) return { ...state, done: true, progressed: false };

  let progress = state.progress;
  let streak = state.streak;
  let progressed = false;
  if (input.miss) streak = 0;
  if (input.hit) streak += 1;

  if (cur.id === "raise") {
    progress = input.handExpression01 >= 0.68 ? progress + input.deltaMs : 0;
    progressed = progress >= cur.targetMs;
    return {
      index: progressed ? state.index + 1 : state.index,
      progress: progressed ? 0 : progress,
      streak,
      done: false,
      progressed,
      progress01: Math.min(1, progress / cur.targetMs),
      labelKey: cur.labelKey,
    };
  }
  if (cur.id === "center") {
    progress = input.handZoneIndex === 1 ? progress + input.deltaMs : 0;
    progressed = progress >= cur.targetMs;
    return {
      index: progressed ? state.index + 1 : state.index,
      progress: progressed ? 0 : progress,
      streak,
      done: false,
      progressed,
      progress01: Math.min(1, progress / cur.targetMs),
      labelKey: cur.labelKey,
    };
  }

  // streak challenge
  progress = streak;
  progressed = streak >= cur.targetCount;
  return {
    index: progressed ? state.index + 1 : state.index,
    progress: progressed ? 0 : progress,
    streak,
    done: progressed,
    progressed,
    progress01: Math.min(1, progress / cur.targetCount),
    labelKey: cur.labelKey,
  };
}
