/**
 * Simple expression detection from MediaPipe Face Landmarker landmarks.
 * Uses mouth and brow positions to infer smiling vs angry.
 */

export type NormalizedLandmark = { x: number; y: number; z: number };

// MediaPipe Face Mesh / Face Landmarker indices (normalized 0–1, y down)
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const UPPER_LIP_TOP = 0;
const LOWER_LIP_BOTTOM = 17;
const LEFT_BROW_INNER = 276;
const LEFT_BROW_OUTER = 46;
const RIGHT_BROW_INNER = 336;
const RIGHT_BROW_OUTER = 107;
const NOSE_TIP = 1;

export type Expression = "smiling" | "neutral" | "angry";

/**
 * Returns expression from face landmarks. Smiling = mouth corners raised;
 * angry = brows lowered (furrowed).
 */
export function getExpressionFromLandmarks(landmarks: NormalizedLandmark[]): Expression {
  if (!landmarks || landmarks.length < 340) return "neutral";

  const get = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  const mouthLeft = get(MOUTH_LEFT);
  const mouthRight = get(MOUTH_RIGHT);
  const upperLip = get(UPPER_LIP_TOP);
  const lowerLip = get(LOWER_LIP_BOTTOM);
  const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
  const leftCornerAboveCenter = mouthLeft.y < mouthCenterY;
  const rightCornerAboveCenter = mouthRight.y < mouthCenterY;
  const mouthOpen = lowerLip.y - upperLip.y > 0.03;
  // Smile: corners above center and some mouth stretch
  const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
  const isSmiling =
    (leftCornerAboveCenter && rightCornerAboveCenter && mouthWidth > 0.15) ||
    (mouthWidth > 0.2 && mouthLeft.y < upperLip.y + 0.02 && mouthRight.y < upperLip.y + 0.02);

  const leftBrowY = (get(LEFT_BROW_INNER).y + get(LEFT_BROW_OUTER).y) / 2;
  const rightBrowY = (get(RIGHT_BROW_INNER).y + get(RIGHT_BROW_OUTER).y) / 2;
  const noseY = get(NOSE_TIP).y;
  // Angry: brows lowered (higher y) relative to nose / eyes
  const browsLowered = leftBrowY > noseY - 0.05 && rightBrowY > noseY - 0.05;
  const browFurrow =
    Math.abs(get(LEFT_BROW_INNER).y - get(LEFT_BROW_OUTER).y) < 0.02 &&
    Math.abs(get(RIGHT_BROW_INNER).y - get(RIGHT_BROW_OUTER).y) < 0.02;
  const isAngry = browsLowered && browFurrow;

  if (isAngry && !isSmiling) return "angry";
  if (isSmiling) return "smiling";
  return "neutral";
}
