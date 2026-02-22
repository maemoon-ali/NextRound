/**
 * Eye contact score from MediaPipe Face Landmarker: only high when face is toward
 * camera AND eyes are looking at camera. Head turned or looking away = low score.
 */

export type NormalizedLandmark = { x: number; y: number; z: number };

const NOSE_TIP = 1;
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

/**
 * 0–1: how much the face is pointed toward the camera (nose near center of frame).
 * Turning head left/right or up/down reduces this.
 */
function headTowardCameraScore(landmarks: NormalizedLandmark[], get: (i: number) => NormalizedLandmark): number {
  const nose = get(NOSE_TIP);
  const centerX = 0.5;
  const centerY = 0.5;
  const dx = Math.abs(nose.x - centerX);
  const dy = Math.abs(nose.y - centerY);
  // Strict: nose must be near center. 0.15 offset ≈ 50% score; 0.25+ ≈ 0.
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 1 - dist * 4);
}

/**
 * 0–1: gaze from iris position. Looking at camera = irises centered in eyes.
 */
function irisGazeScore(landmarks: NormalizedLandmark[], get: (i: number) => NormalizedLandmark): number {
  const leftEyeInner = get(LEFT_EYE_INNER);
  const rightEyeInner = get(RIGHT_EYE_INNER);
  const leftEyeCenterX = (leftEyeInner.x + get(LEFT_EYE_OUTER).x) / 2;
  const rightEyeCenterX = (rightEyeInner.x + get(RIGHT_EYE_OUTER).x) / 2;
  const leftIris = get(LEFT_IRIS);
  const rightIris = get(RIGHT_IRIS);
  const leftOffsetX = Math.abs(leftIris.x - leftEyeCenterX);
  const rightOffsetX = Math.abs(rightIris.x - rightEyeCenterX);
  const leftGaze = Math.max(0, 1 - leftOffsetX * 10);
  const rightGaze = Math.max(0, 1 - rightOffsetX * 10);
  return (leftGaze + rightGaze) / 2;
}

/**
 * Eye contact = face toward camera AND eyes on camera. Either one low => score low.
 */
export function scoreEyeContactFromLandmarks(landmarks: NormalizedLandmark[]): number {
  if (!landmarks || landmarks.length < 400) return 0;

  const get = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  const headScore = headTowardCameraScore(landmarks, get);
  let gazeScore: number;

  if (landmarks.length > 470) {
    gazeScore = irisGazeScore(landmarks, get);
  } else {
    const leftEyeInner = get(LEFT_EYE_INNER);
    const rightEyeInner = get(RIGHT_EYE_INNER);
    const leftEyeCenterX = (leftEyeInner.x + get(LEFT_EYE_OUTER).x) / 2;
    const rightEyeCenterX = (rightEyeInner.x + get(RIGHT_EYE_OUTER).x) / 2;
    const midX = (leftEyeCenterX + rightEyeCenterX) / 2;
    const sym = 1 - Math.min(1, (Math.abs(leftEyeInner.x - midX) + Math.abs(rightEyeInner.x - midX)) * 2);
    gazeScore = sym * 0.7;
  }

  // Multiply so that turning head OR looking away drops the score
  return Math.max(0, Math.min(1, headScore * gazeScore));
}
