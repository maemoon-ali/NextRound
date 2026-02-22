"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from "react";
import { scoreEyeContactFromLandmarks } from "@/lib/eye-contact";
import { getExpressionFromLandmarks, type Expression } from "@/lib/expression";

const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

export interface ScorerSnapshot {
  eyeContact: number;
  tone: number;
  response: number;
  speakingRatio: number;
  /** True when user has been silent for a long stretch (e.g. > 3.5s). */
  longPauseDetected: boolean;
  /** 0–1; higher = more rapid volume on/off (stutter-like). */
  stutterLevel: number;
  /** "fast" | "slow" | "ok" from recent speaking pace. */
  pace: "fast" | "slow" | "ok";
  /** From face landmarks: smiling, neutral, or angry. */
  expression: Expression;
  /** Human-readable tone label for the Tone bar. */
  toneLabel: string;
  /** Normalized 0–1 eye positions for overlay (video space; mirror for display). */
  eyePositions?: { left: { x: number; y: number }; right: { x: number; y: number } } | null;
}

export interface InterviewScorerRef {
  getSnapshot: () => ScorerSnapshot | null;
}

const FILLERS = new Set(["um", "uh", "like", "yeah", "so", "well", "hmm", "er", "ah", "oh"]);
function hasRealWordsInTranscript(transcript: string | undefined): boolean {
  if (!transcript || !transcript.trim()) return false;
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const real = words.filter((w) => !FILLERS.has(w.toLowerCase().replace(/[^a-z]/g, "")));
  return real.length >= 2;
}

interface InterviewScorerProps {
  active: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mediaStream?: MediaStream | null;
  /** Live transcript; tone and response stay at 0 until transcript has real words. */
  transcript?: string;
  onScoresChange?: (scores: ScorerSnapshot) => void;
}

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const InterviewScorer = forwardRef<InterviewScorerRef, InterviewScorerProps>(
  function InterviewScorer({ active, videoRef, mediaStream, transcript = "", onScoresChange }, ref) {
    const transcriptRef = useRef(transcript);
    transcriptRef.current = transcript;
    const snapshotRef = useRef<ScorerSnapshot>({
      eyeContact: 0,
      tone: 0.05,
      response: 0.05,
      speakingRatio: 0,
      longPauseDetected: false,
      stutterLevel: 0,
      pace: "ok",
      expression: "neutral",
      toneLabel: "Silent",
      eyePositions: null,
    });
    const [liveScores, setLiveScores] = useState<ScorerSnapshot>(snapshotRef.current);
    const [modelsReady, setModelsReady] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const speakingSamplesRef = useRef({ total: 0, speaking: 0 });
    const lastSpeakingAtRef = useRef<number>(0);
    const silenceStartRef = useRef<number | null>(null);
    const volumeHistoryRef = useRef<boolean[]>([]);
    const recentSpeakingRatioRef = useRef<number[]>([]);
    const faceLandmarkerRef = useRef<{
      detectForVideo: (video: HTMLVideoElement, timestamp: number) => { faceLandmarks: { x: number; y: number; z: number }[][] };
    } | null>(null);
    const lastVideoTimeRef = useRef(-1);

    useImperativeHandle(ref, () => ({
      getSnapshot: () => snapshotRef.current,
    }));

    // Set up audio analysis from shared stream or fallback to mic-only
    useEffect(() => {
      if (!active) return;
      const stream = mediaStream ?? null;
      if (stream?.getAudioTracks?.().length) {
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyserRef.current = analyser;
      }
      if (!mediaStream) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
          streamRef.current = s;
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          const source = ctx.createMediaStreamSource(s);
          source.connect(analyser);
          analyserRef.current = analyser;
        }).catch(() => {});
      }
      return () => {
        if (!mediaStream) streamRef.current?.getTracks().forEach((t) => t.stop());
        audioContextRef.current?.close();
        analyserRef.current = null;
        streamRef.current = null;
      };
    }, [active, mediaStream]);

    // Load MediaPipe Face Landmarker for real eye detection
    useEffect(() => {
      if (!active) return;
      let cancelled = false;
      (async () => {
        try {
          const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          if (cancelled) return;
          const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
            runningMode: "VIDEO",
            numFaces: 1,
          });
          if (cancelled) return;
          faceLandmarkerRef.current = faceLandmarker as unknown as typeof faceLandmarkerRef.current;
          setModelsReady(true);
        } catch {
          setModelsReady(true);
        }
      })();
      return () => {
        cancelled = true;
        faceLandmarkerRef.current = null;
      };
    }, [active]);

    // Real-time loop: eye contact from Face Landmarker + tone/speaking from audio. Updates live metrics every 100ms.
    useEffect(() => {
      if (!active) return;

      const dataArray = new Uint8Array(256);
      let rafId = 0;

      function tick() {
        if (!analyserRef.current) {
          rafId = requestAnimationFrame(tick);
          return;
        }

        const video = videoRef?.current;
        const flm = faceLandmarkerRef.current;
        let eyeContact = snapshotRef.current.eyeContact;

        let expression: Expression = "neutral";
        let eyePositions: ScorerSnapshot["eyePositions"] = null;
        if (video && video.readyState >= 2 && flm) {
          const videoTime = video.currentTime * 1000;
          if (videoTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = videoTime;
            try {
              const result = flm.detectForVideo(video, videoTime);
              if (result?.faceLandmarks?.[0]) {
                const landmarks = result.faceLandmarks[0];
                eyeContact = scoreEyeContactFromLandmarks(landmarks);
                expression = getExpressionFromLandmarks(landmarks);
                if (landmarks.length > RIGHT_IRIS) {
                  const left = landmarks[LEFT_IRIS];
                  const right = landmarks[RIGHT_IRIS];
                  if (left && right)
                    eyePositions = {
                      left: { x: left.x, y: left.y },
                      right: { x: right.x, y: right.y },
                    };
                }
              } else {
                eyeContact = 0;
              }
            } catch {
              eyeContact = 0;
            }
          } else {
            eyePositions = snapshotRef.current.eyePositions ?? null;
          }
        } else {
          eyeContact = 0;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        const speaking = avg > 15;
        const now = Date.now();
        const sr = speakingSamplesRef.current;
        sr.total += 1;
        if (speaking) sr.speaking += 1;
        const speakingRatio = sr.total > 0 ? sr.speaking / sr.total : 0;

        // Long pause: silent for > 3.5s
        if (speaking) {
          lastSpeakingAtRef.current = now;
          silenceStartRef.current = null;
        } else {
          if (silenceStartRef.current === null) silenceStartRef.current = now;
        }
        const silenceDuration = silenceStartRef.current !== null ? (now - silenceStartRef.current) / 1000 : 0;
        const longPauseDetected = silenceDuration > 3.5;

        // Recent speech: fraction of last N frames with volume above threshold (genuine activity)
        const vh = volumeHistoryRef.current;
        vh.push(speaking);
        if (vh.length > 25) vh.shift();
        const recentSpeakingFrames = vh.filter(Boolean).length;
        const recentSpeakingRatioShort = vh.length > 0 ? recentSpeakingFrames / vh.length : 0;

        let crossings = 0;
        for (let i = 1; i < vh.length; i++) if (vh[i] !== vh[i - 1]) crossings++;
        const stutterLevel = vh.length >= 10 ? Math.min(1, crossings / 12) : 0;

        // Pace: use recent speaking activity (not cumulative ratio)
        const rsr = recentSpeakingRatioRef.current;
        rsr.push(recentSpeakingRatioShort);
        if (rsr.length > 60) rsr.shift();
        const recentRatio = rsr.length > 0 ? rsr.reduce((a, b) => a + b, 0) / rsr.length : 0;
        const pace: "fast" | "slow" | "ok" =
          recentRatio > 0.85 ? "fast" : recentRatio < 0.3 ? "slow" : "ok";

        const variance =
          dataArray.length > 0
            ? dataArray.reduce((acc, v) => acc + (v - avg) ** 2, 0) / dataArray.length
            : 0;
        const sqrtVar = Math.sqrt(variance);
        const transcriptHasRealWords = hasRealWordsInTranscript(transcriptRef.current);

        // Tone and response stay at 0 until transcript is capturing real words
        if (!transcriptHasRealWords) {
          const next: ScorerSnapshot = {
            eyeContact: Math.max(0, Math.min(1, eyeContact)),
            tone: 0,
            response: 0,
            speakingRatio: Math.max(0, Math.min(0.95, speakingRatio)),
            longPauseDetected: silenceDuration > 3.5,
            stutterLevel: vh.length >= 10 ? Math.min(1, crossings / 12) : 0,
            pace: recentRatio > 0.85 ? "fast" : recentRatio < 0.3 ? "slow" : "ok",
            expression,
            toneLabel: "No words yet",
            eyePositions,
          };
          snapshotRef.current = next;
          setLiveScores(next);
          onScoresChange?.(next);
          rafId = requestAnimationFrame(tick);
          return;
        }

        // Tone: full 0–100% range based on audio (variation = engagement)
        const isSilent = recentSpeakingRatioShort < 0.15;
        const isMumblingOrFlat = !isSilent && sqrtVar < 12;
        const isMonotoneOrBored = !isSilent && sqrtVar >= 12 && sqrtVar < 25;
        const isLowEngagement = !isSilent && sqrtVar >= 25 && sqrtVar < 40;

        let toneScore: number;
        let toneLabel: string;
        if (isSilent) {
          toneScore = 0;
          toneLabel = "Silent";
        } else if (isMumblingOrFlat) {
          toneScore = Math.max(0, Math.min(0.2, 0.02 + sqrtVar / 100));
          toneLabel = sqrtVar < 6 ? "Mumbling" : "Grumbling / unclear";
        } else if (isMonotoneOrBored) {
          toneScore = Math.max(0.15, Math.min(0.4, 0.1 + sqrtVar / 70));
          toneLabel = sqrtVar < 18 ? "Monotone" : "Bored / flat";
        } else if (isLowEngagement) {
          toneScore = Math.max(0.35, Math.min(0.55, 0.2 + sqrtVar / 90));
          toneLabel = "Low energy";
        } else {
          toneScore = Math.max(0.5, Math.min(1, 0.35 + sqrtVar / 55));
          toneLabel =
            toneScore >= 0.85
              ? "Enthusiastic"
              : toneScore >= 0.7
                ? "Animated"
                : toneScore >= 0.55
                  ? "Moderate"
                  : "Calm";
        }

        // Response: full range; only non-zero when we have real words (already gated above)
        const response = (eyeContact + toneScore + Math.max(0, Math.min(0.95, speakingRatio))) / 3;
        const responseClamped = Math.max(0, Math.min(1, response));

        const next: ScorerSnapshot = {
          eyeContact: Math.max(0, Math.min(1, eyeContact)),
          tone: Math.max(0, Math.min(1, toneScore)),
          response: responseClamped,
          speakingRatio: Math.max(0, Math.min(0.95, speakingRatio)),
          longPauseDetected,
          stutterLevel,
          pace,
          expression,
          toneLabel,
          eyePositions,
        };
        snapshotRef.current = next;
        setLiveScores(next);
        onScoresChange?.(next);

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, [active]);

    return (
      <div className="rounded-xl border border-emerald-500/20 bg-zinc-800/50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Live metrics
        </p>
        {modelsReady && (
          <p className="mb-2 text-[10px] text-emerald-500/80">Real-time eye tracking active</p>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MetricBar label="Eye contact" value={liveScores.eyeContact} />
          <MetricBar label="Tone" value={liveScores.tone} toneLabel={liveScores.toneLabel} toneLabelPoor={isPoorToneLabel(liveScores.toneLabel)} />
          <MetricBar label="Response" value={liveScores.response} />
          <MetricBar label="Speaking time" value={liveScores.speakingRatio} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {liveScores.longPauseDetected && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Long pause</span>
          )}
          {liveScores.stutterLevel > 0.5 && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Stuttering</span>
          )}
          {liveScores.pace === "fast" && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Speaking too fast</span>
          )}
          {liveScores.pace === "slow" && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Speaking too slow</span>
          )}
        </div>
      </div>
    );
  }
);

function isPoorToneLabel(label: string | undefined): boolean {
  if (!label) return false;
  const poor = ["no words", "silent", "mumbling", "grumbling", "unclear", "monotone", "bored", "flat", "low energy"];
  return poor.some((p) => label.toLowerCase().includes(p));
}

function MetricBar({
  label,
  value,
  toneLabel,
  toneLabelPoor,
}: {
  label: string;
  value: number;
  toneLabel?: string;
  toneLabelPoor?: boolean;
}) {
  const pct = Math.round(value * 100);
  let color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-zinc-500";
  if (label === "Tone" && toneLabelPoor) color = pct <= 25 ? "bg-red-500" : "bg-amber-500";
  return (
    <div>
      <div className="flex justify-between text-zinc-400">
        <span>{label}</span>
        <span className="flex items-center gap-1.5">
          {toneLabel != null && (
            <span className={`text-xs font-medium ${toneLabelPoor ? "text-amber-400" : "text-zinc-500"}`}>{toneLabel}</span>
          )}
          <span>{pct}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full rounded-full ${color} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
