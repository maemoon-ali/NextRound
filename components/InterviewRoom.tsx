"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WebcamCapture } from "./WebcamCapture";
import { InterviewScorer, type InterviewScorerRef, type ScorerSnapshot } from "./InterviewScorer";

const TIME_PER_QUESTION_MS = 2 * 60 * 1000; // 2 minutes

/** Split transcript and wrap um, uh, (long pause) in red spans for captions. */
function CaptionWithHighlights({ text }: { text: string }) {
  if (!text.trim()) return null;
  const parts: React.ReactNode[] = [];
  const re = /\b(um|uh)\b|\(long pause\)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    parts.push(
      <span key={m.index} className="text-red-400 font-medium">
        {m[0]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

/** Emoji reflecting interviewer reaction: quality (0–1) + expression (smiling/neutral/angry). */
function interviewerEmoji(
  quality: number,
  expression: "smiling" | "neutral" | "angry"
): string {
  if (expression === "angry") return "😒"; // annoyed
  if (quality >= 0.85) return "😄"; // excited
  if (quality >= 0.7 && expression === "smiling") return "😊"; // smiling
  if (quality >= 0.7) return "😮"; // impressed
  if (quality >= 0.55) return "🙂"; // neutral-positive
  if (quality >= 0.45) return "🤔"; // curious
  if (quality >= 0.35) return "😐"; // neutral
  if (quality >= 0.25) return "😕"; // confused
  return "😑"; // bored
}

/** Timer ring: thin circle that shrinks with time left; color goes green → orange → yellow. */
function TimerRing({
  timeLeftMs,
  totalMs,
  size = 88,
  strokeWidth = 3,
}: {
  timeLeftMs: number;
  totalMs: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = totalMs > 0 ? timeLeftMs / totalMs : 0;
  const strokeDashoffset = circumference * (1 - progress);
  // Color: green when lots of time left → orange → yellow as time runs out
  const t = 1 - progress; // 0 = full time left, 1 = no time left
  const color =
    t < 0.35
      ? `rgb(34, 197, 94)` // green
      : t < 0.7
        ? `rgb(249, 115, 22)` // orange
        : `rgb(250, 204, 21)`; // yellow when little time left
  return (
    <svg width={size} height={size} className="absolute inset-0 shrink-0">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-500 ease-linear"
      />
    </svg>
  );
}

export interface QuestionScore {
  questionIndex: number;
  eyeContactScore: number;
  toneScore: number;
  responseScore: number;
  speakingTimeRatio: number;
  timeUsedMs: number;
}

interface InterviewRoomProps {
  company?: string;
  role: string;
  questions: string[];
}

export function InterviewRoom({ company, role, questions }: InterviewRoomProps) {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [phase, setPhase] = useState<"intro" | "interview" | "done">("intro");
  const [scores, setScores] = useState<QuestionScore[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(TIME_PER_QUESTION_MS);
  const [liveScores, setLiveScores] = useState<ScorerSnapshot | null>(null);
  const captionsOn = true; // always on, not user-toggleable
  const [transcript, setTranscript] = useState("");
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [questionPreviewEndTime, setQuestionPreviewEndTime] = useState<number | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [donePhase, setDonePhase] = useState<"loading" | "result">("loading");
  const [resultOutcome, setResultOutcome] = useState<"Hired!" | "Considering..." | "Rejected">("Considering...");
  const scorerRef = useRef<InterviewScorerRef | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptFinalLengthRef = useRef(0);
  const captionScrollRef = useRef<HTMLDivElement | null>(null);
  const lastLongPauseRef = useRef(false);
  const lastSpokenQuestionRef = useRef<number>(-1);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const responseTranscriptsRef = useRef<string[]>([]);

  // Acquire webcam + mic on mount; keep stream for the whole session and only stop when leaving the page
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: true })
      .then((s) => {
        stream = s;
        setMediaStream(s);
      })
      .catch(() => {});
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const question = questions[currentQ];

  function scoreFromTranscript(text: string): number {
    const t = (text ?? "").trim();
    if (t.length === 0) return 0;
    const words = t.split(/\s+/).filter(Boolean).length;
    const sentences = t.split(/[.!?]+/).filter(Boolean).length;
    if (words < 5) return Math.min(1, 0.1 + words * 0.02);
    if (words < 15) return 0.2 + (words / 15) * 0.25;
    if (words < 40) return 0.45 + (words / 40) * 0.25;
    if (words < 80) return 0.7 + (words / 80) * 0.2;
    if (words < 150) return 0.9 + (words / 150) * 0.1;
    return Math.min(1, 0.95 + (sentences >= 3 ? 0.05 : 0));
  }

  const finishQuestion = useCallback(() => {
    responseTranscriptsRef.current[currentQ] = transcript;
    const snapshot = scorerRef.current?.getSnapshot();
    const start = questionStartTime ?? Date.now();
    const timeUsedMs = Date.now() - start;
    const trimmed = (transcript ?? "").trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const hasSpeech = trimmed.length >= 10 && wordCount >= 2;
    let toneScore = 0;
    let responseScore = 0;
    let speakingTimeRatio = 0;
    if (hasSpeech) {
      const rawSpeaking = snapshot?.speakingRatio ?? 0.5;
      speakingTimeRatio = Math.max(0, Math.min(1, rawSpeaking));
      responseScore = scoreFromTranscript(transcript);
      toneScore = Math.max(0, Math.min(1, (snapshot?.tone ?? 0)));
      const quietByWords = wordCount < 25 ? wordCount / 25 : 1;
      const quietByAudio = rawSpeaking < 0.3 ? rawSpeaking / 0.3 : 1;
      const quietFactor = Math.min(quietByWords, quietByAudio);
      toneScore *= quietFactor;
      responseScore *= quietFactor;
    }
    setScores((prev) => [
      ...prev,
      {
        questionIndex: currentQ,
        eyeContactScore: snapshot?.eyeContact ?? 0,
        toneScore,
        responseScore,
        speakingTimeRatio,
        timeUsedMs,
      },
    ]);
    if (currentQ + 1 >= questions.length) {
      setQuestionStartTime(null);
      setPhase("done");
    } else {
      setQuestionStartTime(null);
      setQuestionPreviewEndTime(Date.now() + 15000);
      setTranscript("");
      transcriptFinalLengthRef.current = 0;
      lastLongPauseRef.current = false;
      setCurrentQ((q) => q + 1);
      setTimeLeftMs(TIME_PER_QUESTION_MS);
    }
  }, [currentQ, questions.length, questionStartTime, transcript]);

  // Read question aloud via Eleven Labs TTS when it appears on the webcam (15s preview)
  useEffect(() => {
    if (phase !== "interview" || questionPreviewEndTime === null || !question?.trim() || lastSpokenQuestionRef.current === currentQ) return;
    lastSpokenQuestionRef.current = currentQ;
    let cancelled = false;
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: question }),
    })
      .then((res) => {
        if (cancelled || !res.ok) return null;
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled || !buffer) return;
        const blob = new Blob([buffer], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        ttsAudioRef.current = audio;
        audio.play().catch(() => {}).finally(() => {
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
    };
  }, [phase, questionPreviewEndTime, currentQ, question]);

  // When interview ends: show loading 3–4s then outcome (Hired / Considering / Rejected) from average score
  useEffect(() => {
    if (phase !== "done") return;
    setDonePhase("loading");
    const timer = setTimeout(() => {
      const avg =
        scores.length > 0
          ? scores.reduce(
              (a, s) =>
                a +
                (s.eyeContactScore + s.toneScore + s.responseScore + s.speakingTimeRatio) / 4,
              0
            ) / scores.length
          : 0.5;
      if (avg >= 0.65) setResultOutcome("Hired!");
      else if (avg >= 0.4) setResultOutcome("Considering...");
      else setResultOutcome("Rejected");
      setDonePhase("result");
    }, 3500);
    return () => clearTimeout(timer);
  }, [phase, scores]);

  // Closed captioning: Web Speech API — only when not in 15s preview
  useEffect(() => {
    if (phase !== "interview" || !captionsOn || questionPreviewEndTime !== null || typeof window === "undefined") return;
    const Win = window as Window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const lenRef = transcriptFinalLengthRef;
      setTranscript((prev) => {
        const soFar = prev.slice(0, lenRef.current);
        if (finalText) lenRef.current = soFar.length + finalText.length;
        return soFar + finalText + interimText;
      });
    };
    recognition.start();
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch (_) {}
      recognitionRef.current = null;
    };
  }, [phase, captionsOn, questionPreviewEndTime]);

  useEffect(() => {
    captionScrollRef.current?.scrollTo({ top: captionScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  // Inject "(long pause)" into captions when scorer detects it (once per occurrence)
  useEffect(() => {
    if (phase !== "interview" || !captionsOn || !liveScores?.longPauseDetected) {
      if (liveScores && !liveScores.longPauseDetected) lastLongPauseRef.current = false;
      return;
    }
    if (lastLongPauseRef.current) return;
    lastLongPauseRef.current = true;
    setTranscript((prev) => prev + " (long pause) ");
    transcriptFinalLengthRef.current += " (long pause) ".length;
  }, [phase, captionsOn, liveScores?.longPauseDetected]);

  // 15s question preview: tick every second; when done, clear preview and start 2-min timer
  useEffect(() => {
    if (phase !== "interview" || questionPreviewEndTime === null) return;
    const endAt = questionPreviewEndTime;
    const interval = setInterval(() => {
      const now = Date.now();
      setPreviewTick((t) => t + 1);
      if (now >= endAt) {
        setQuestionPreviewEndTime(null);
        setQuestionStartTime(now);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, questionPreviewEndTime]);

  // Timer (2 min per question)
  useEffect(() => {
    if (phase !== "interview" || currentQ >= questions.length) return;
    if (questionStartTime === null) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStartTime;
      const left = Math.max(0, TIME_PER_QUESTION_MS - elapsed);
      setTimeLeftMs(left);
      if (left === 0) {
        clearInterval(interval);
        finishQuestion();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [phase, currentQ, questionStartTime, questions.length, finishQuestion]);

  function startInterview() {
    const now = Date.now();
    setPhase("interview");
    setCurrentQ(0);
    setQuestionStartTime(null);
    setQuestionPreviewEndTime(now + 15000);
    setTimeLeftMs(TIME_PER_QUESTION_MS);
  }

  function viewResults() {
    try {
      const transcripts = responseTranscriptsRef.current.slice(0, questions.length);
      sessionStorage.setItem(
        "interviewResults",
        JSON.stringify({ company: company ?? "", role, scores, questions, transcripts, interviewType: "behavioral" })
      );
    } catch (_) {}
    router.push("/results");
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-1 flex-col min-h-0 w-full gap-3.5">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 relative min-h-0 rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden h-full">
            <WebcamCapture
              ref={videoRef}
              stream={mediaStream}
              backgroundMode="normal"
              brightness={brightness}
              contrast={contrast}
              className="h-full w-full min-h-0 rounded-lg"
            />
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col justify-center">
            <h2 className="text-xl font-semibold text-white">Practice: {role}</h2>
            <p className="mt-2 text-zinc-400 text-sm">
              You’ll get 5 behavioral questions. You have 2 minutes to answer each.
              We’ll use your webcam and microphone to score eye contact, tone, and response quality.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-zinc-400">
              <li>Allow camera and microphone when prompted</li>
              <li>Look at the camera when speaking</li>
              <li>Speak clearly; avoid long pauses</li>
            </ul>
            <button
              onClick={startInterview}
              className="mt-6 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
            >
              Start interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-1 flex-col min-h-0 w-full gap-3.5">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 relative min-h-0 rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden h-full">
            <WebcamCapture
              ref={videoRef}
              stream={mediaStream}
              backgroundMode="normal"
              brightness={brightness}
              contrast={contrast}
              className="h-full w-full min-h-0 rounded-lg"
            />
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col justify-center text-center">
            {donePhase === "loading" && (
              <>
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-hidden />
                <p className="mt-4 text-zinc-300">Reviewing your interview…</p>
              </>
            )}
            {donePhase === "result" && (
              <>
                <p
                  className={`text-2xl font-bold tracking-wide ${
                    resultOutcome === "Hired!"
                      ? "text-emerald-400 animate-pulse"
                      : resultOutcome === "Considering..."
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {resultOutcome}
                </p>
                <p className="mt-2 text-zinc-400">View your full scores and breakdown.</p>
                <button
                  onClick={viewResults}
                  className="mt-6 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
                >
                  View results &amp; metrics
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const secs = Math.ceil(timeLeftMs / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const timeStr = `${mins}:${s.toString().padStart(2, "0")}`;
  const showQuestionInWebcam = questionPreviewEndTime !== null && Date.now() < questionPreviewEndTime;
  const previewSecondsLeft = questionPreviewEndTime
    ? Math.max(0, Math.ceil((questionPreviewEndTime - Date.now()) / 1000))
    : 0;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden w-full">
      {/* Top: question + timer (only when not in 15s preview) */}
      {!showQuestionInWebcam && (
        <div className="shrink-0 mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-800/50 px-3 py-2">
          <p className="text-emerald-500 text-xs sm:text-sm flex-1 min-w-0">{question}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400">
              Q{currentQ + 1}/{questions.length}
            </span>
            <span
              className={`font-mono text-sm ${
                timeLeftMs < 30000 ? "text-amber-400" : "text-white"
              }`}
            >
              {timeStr}
            </span>
          </div>
        </div>
      )}

      {/* Main: webcam + interviewer panel */}
      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-4 gap-2.5">
        <div className="lg:col-span-3 flex flex-col min-h-0 gap-1.5">
          <div className="group relative flex-1 min-h-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 aspect-video lg:aspect-auto">
            <WebcamCapture
              ref={videoRef}
              stream={mediaStream}
              backgroundMode="normal"
              brightness={brightness}
              contrast={contrast}
              className="h-full w-full min-h-0 rounded-lg"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
              <div className="pointer-events-auto rounded-lg border border-zinc-600 bg-zinc-900/95 px-2 py-3 flex items-center gap-3 text-zinc-300">
                <label className="flex flex-col items-center gap-1.5" title="Brightness">
                  <span className="text-base leading-none" aria-hidden>☀</span>
                  <div className="h-16 w-2 flex items-center justify-center">
                    <input
                      type="range"
                      min="0.3"
                      max="2"
                      step="0.1"
                      value={brightness}
                      onChange={(e) => setBrightness(parseFloat(e.target.value))}
                      className="accent-emerald-500"
                      style={{
                        transform: "rotate(-90deg)",
                        width: "64px",
                        height: "8px",
                        marginLeft: "-28px",
                        marginRight: "-28px",
                      }}
                    />
                  </div>
                </label>
                <label className="flex flex-col items-center gap-1.5" title="Contrast">
                  <span className="text-base leading-none" aria-hidden>◐</span>
                  <div className="h-16 w-2 flex items-center justify-center">
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={contrast}
                      onChange={(e) => setContrast(parseFloat(e.target.value))}
                      className="accent-emerald-500"
                      style={{
                        transform: "rotate(-90deg)",
                        width: "64px",
                        height: "8px",
                        marginLeft: "-28px",
                        marginRight: "-28px",
                      }}
                    />
                  </div>
                </label>
              </div>
            </div>
            {liveScores?.eyePositions && !showQuestionInWebcam && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <div
                  className="absolute w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-400/30 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(1 - liveScores.eyePositions.left.x) * 100}%`,
                    top: `${liveScores.eyePositions.left.y * 100}%`,
                  }}
                />
                <div
                  className="absolute w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-400/30 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(1 - liveScores.eyePositions.right.x) * 100}%`,
                    top: `${liveScores.eyePositions.right.y * 100}%`,
                  }}
                />
              </div>
            )}
            {showQuestionInWebcam && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-6 overflow-y-auto">
                <p className="text-emerald-500 text-lg sm:text-xl md:text-2xl leading-snug text-center max-w-3xl font-bold">
                  {question}
                </p>
                <div className="absolute bottom-6 left-6 right-6 h-2 rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(previewSecondsLeft / 15) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div
            ref={(el) => {
              captionScrollRef.current = el;
            }}
            className="shrink-0 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200 overflow-y-auto"
            style={{ maxHeight: "2.4em", lineHeight: 1.25 }}
          >
            {showQuestionInWebcam ? (
              <span className="text-zinc-500 italic">Captions will start when you begin answering.</span>
            ) : (
              <CaptionWithHighlights text={transcript} />
            )}
          </div>
        </div>
        <div className="lg:col-span-1 flex flex-col min-h-0 shrink-0">
          <div className="relative flex-1 min-h-0 rounded-lg border border-zinc-700 bg-zinc-800/80 flex flex-col items-center justify-center p-3">
            <div className="relative flex h-[88px] w-[88px] items-center justify-center">
              <TimerRing
                timeLeftMs={timeLeftMs}
                totalMs={TIME_PER_QUESTION_MS}
                size={88}
                strokeWidth={3}
              />
              <span className="text-4xl select-none" role="img" aria-label="Interviewer">
                {interviewerEmoji(
                  liveScores
                    ? (liveScores.eyeContact + liveScores.tone + liveScores.response + liveScores.speakingRatio) / 4
                    : 0.6,
                  liveScores?.expression ?? "neutral"
                )}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-500">Interviewer</p>
          </div>
          <button
            onClick={finishQuestion}
            className="mt-2 w-full rounded-lg border border-zinc-600 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Next question
          </button>
        </div>
      </div>

      {/* Live stats — compact */}
      <div className="shrink-0 mt-1.5">
        <InterviewScorer
          ref={scorerRef}
          active={phase === "interview"}
          videoRef={videoRef}
          mediaStream={mediaStream}
          transcript={transcript}
          onScoresChange={setLiveScores}
        />
      </div>
    </div>
  );
}
