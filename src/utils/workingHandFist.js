import { isHandFist } from "./isHandFist.js";

/**
 * @param {import('@mediapipe/holistic').Results} results
 * @param {'left' | 'right'} damagedSide
 * @returns {boolean}
 */
export function computeWorkingFist(results, damagedSide) {
  const workingIsRight = damagedSide === "right";
  const lm = workingIsRight
    ? results.rightHandLandmarks
    : results.leftHandLandmarks;
  return isHandFist(lm);
}
