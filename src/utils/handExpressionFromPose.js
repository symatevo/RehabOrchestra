/**
 * Hand "expression" from MediaPipe Holistic pose (normalized image coords, y down).
 * Higher wrists (smaller y) → higher expression, matching semi-conductor getNormalisedHeight idea.
 * Landmarks are in selfie video space (same as draw canvas); user raising hands lowers y.
 */

const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

/** @param {number} x */
function zoneIndexFromMidX(x) {
  if (x < 1 / 3) return 0;
  if (x < 2 / 3) return 1;
  return 2;
}

/**
 * @param {readonly { x: number; y: number; z?: number }[] | undefined} landmarks
 * @param {number} smoothedPrev previous smoothed expression 0..1
 * @param {number} alpha smoothing 0..1, higher = more smoothing
 */
export function computeHandExpressionFromPose(landmarks, smoothedPrev, alpha = 0.72) {
  if (!landmarks || !landmarks[LEFT_WRIST] || !landmarks[RIGHT_WRIST]) {
    const next = alpha * smoothedPrev + (1 - alpha) * 0.5;
    return { expression01: next, zoneIndex: 1 };
  }
  const ly = landmarks[LEFT_WRIST].y;
  const ry = landmarks[RIGHT_WRIST].y;
  const lx = landmarks[LEFT_WRIST].x;
  const rx = landmarks[RIGHT_WRIST].x;
  const raw = 1 - Math.min(ly, ry);
  const clamped = Math.min(1, Math.max(0, raw));
  const expression01 = alpha * smoothedPrev + (1 - alpha) * clamped;
  const midX = (lx + rx) / 2;
  const zoneIndex = zoneIndexFromMidX(midX);
  return { expression01, zoneIndex };
}
