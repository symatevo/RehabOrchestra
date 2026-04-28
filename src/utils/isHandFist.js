/**
 * MediaPipe hand landmarks (21 points). Returns true if hand looks like a fist.
 * @param {import('@mediapipe/holistic').NormalizedLandmarkList | null | undefined} lm
 */
export function isHandFist(lm) {
  if (!lm || lm.length < 21) return false;

  const wrist = lm[0];
  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];

  let closed = 0;
  for (let i = 0; i < 4; i++) {
    const tip = lm[tips[i]];
    const mcp = lm[mcps[i]];
    const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y, tip.z - wrist.z);
    const dMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y, mcp.z - wrist.z);
    if (dTip < dMcp * 0.95) closed++;
  }

  const thumbTip = lm[4];
  const thumbIp = lm[3];
  const thumbMcp = lm[2];
  const dThumb = Math.hypot(
    thumbTip.x - thumbMcp.x,
    thumbTip.y - thumbMcp.y,
    thumbTip.z - thumbMcp.z
  );
  const dThumbSeg = Math.hypot(
    thumbIp.x - thumbMcp.x,
    thumbIp.y - thumbMcp.y,
    thumbIp.z - thumbMcp.z
  );
  const thumbClosed = dThumb < dThumbSeg * 1.5;

  return closed >= 3;
}
