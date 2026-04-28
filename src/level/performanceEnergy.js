/**
 * Hybrid weighted fill:
 * - cue hits provide the main chunk
 * - expressive hand movement adds a smaller passive stream
 * - tiny idle decay keeps momentum meaningful
 */
export function nextPerformanceEnergy({
  prevEnergy,
  dtMs,
  expression01,
  expressionDeltaAbs,
  hitKind,
}) {
  let next = prevEnergy;
  if (hitKind === "perfect") next += 6.2;
  else if (hitKind === "late") next += 3.7;

  const movementGain = expressionDeltaAbs * 55 + expression01 * 0.035 * (dtMs / 16.67);
  next += movementGain;

  // tiny idle drain only when movement is very low
  if (expressionDeltaAbs < 0.003) next -= 0.02 * (dtMs / 16.67);
  return Math.max(0, Math.min(100, next));
}
