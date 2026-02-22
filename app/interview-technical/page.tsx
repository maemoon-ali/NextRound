"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

function TechnicalInterviewLogo({ company }: { company: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (company || "?").trim().slice(0, 2).toUpperCase() || "?";
  const hue = (company || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const logoSrc = company?.trim() ? `/api/logo?company=${encodeURIComponent(company.trim())}` : "";
  if (logoSrc && !imgFailed) {
    return (
      <img
        src={logoSrc}
        alt=""
        className="h-8 w-8 shrink-0 rounded object-contain"
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 40%)` }}
    >
      {initial}
    </span>
  );
}

const TIME_LIMIT_MS = 15 * 60 * 1000;

const EXAMPLE_PROBLEM = {
  title: "Two Sum",
  description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
  examples: `Example 1:
Input: nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

Example 2:
Input: nums = [3, 2, 4], target = 6
Output: [1, 2]

Example 3:
Input: nums = [3, 3], target = 6
Output: [0, 1]`,
  constraints: `2 <= len(nums) <= 10^4
-10^9 <= nums[i] <= 10^9
-10^9 <= target <= 10^9
Only one valid answer exists.`,
  defaultCode: `def two_sum(nums: list[int], target: int) -> list[int]:
    # your code here
    pass
`,
};

function scoreReasoningFromTranscript(text: string): number {
  const t = (text ?? "").trim().toLowerCase();
  if (t.length < 20) return 0;
  const words = t.split(/\s+/).filter(Boolean).length;
  const reasoningMarkers = /\b(because|so|first|then|next|approach|algorithm|complexity|time|space|o\(n\)|hash|map|iterate|loop|step)\b/gi;
  const markerCount = (t.match(reasoningMarkers) ?? []).length;
  const structureScore = Math.min(1, words / 80) * 0.5;
  const reasoningScore = Math.min(1, markerCount / 8) * 0.5;
  return Math.min(1, structureScore + reasoningScore + (words >= 50 ? 0.1 : 0));
}

function InterviewTechnicalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const company = searchParams?.get("company") ?? "";
  const role = searchParams?.get("role") ?? "Software Engineer";
  const function_ = searchParams?.get("function") ?? "";

  const [phase, setPhase] = useState<"intro" | "coding" | "done">("intro");
  const [code, setCode] = useState(EXAMPLE_PROBLEM.defaultCode);
  const [transcript, setTranscript] = useState("");
  const [runResult, setRunResult] = useState<{
    passed: boolean;
    results: { nums: number[]; target: number; expected: number[]; got: number[] | null; passed: boolean; error?: string }[];
    stdout?: string;
    stderr?: string;
  } | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(TIME_LIMIT_MS);
  const [startTime, setStartTime] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptLengthRef = useRef(0);
  const transcriptRef = useRef("");
  transcriptRef.current = transcript;

  const problemPrompt = `Technical problem: ${EXAMPLE_PROBLEM.title}. ${EXAMPLE_PROBLEM.description.replace(/\n/g, " ")} Explain your approach and reasoning as you solve it.`;

  const handleSubmit = useCallback(() => {
    if (phase !== "coding") return;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    recognitionRef.current = null;
    const elapsed = startTime != null ? Date.now() - startTime : 0;
    const trimmed = transcriptRef.current.trim();
    const hasSpeech = trimmed.length >= 20;
    const responseScore = hasSpeech ? scoreReasoningFromTranscript(transcriptRef.current) : 0;
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const toneScore = hasSpeech ? Math.min(1, 0.3 + (wordCount / 100) * 0.5) : 0;
    const speakingTimeRatio = hasSpeech ? Math.min(0.95, 0.2 + wordCount / 200) : 0;
    const scores = [
      {
        questionIndex: 0,
        eyeContactScore: 0,
        toneScore,
        responseScore,
        speakingTimeRatio,
        timeUsedMs: elapsed,
      },
    ];
    sessionStorage.setItem(
      "interviewResults",
      JSON.stringify({
        company: company ?? "",
        role: `Technical | ${role}`,
        scores,
        questions: [problemPrompt],
        transcripts: [transcriptRef.current],
        interviewType: "technical",
      })
    );
    setPhase("done");
    router.push("/results");
  }, [phase, startTime, role, problemPrompt, router]);

  useEffect(() => {
    if (phase !== "coding" || startTime === null) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, TIME_LIMIT_MS - elapsed);
      setTimeLeftMs(left);
      if (left === 0) handleSubmit();
    }, 500);
    return () => clearInterval(interval);
  }, [phase, startTime, handleSubmit]);

  const startCoding = useCallback(() => {
    setPhase("coding");
    setStartTime(Date.now());
    setTimeLeftMs(TIME_LIMIT_MS);
    const Win = window as Window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (SR) {
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
        setTranscript((prev) => {
          const soFar = prev.slice(0, transcriptLengthRef.current);
          if (finalText) transcriptLengthRef.current = soFar.length + finalText.length;
          return soFar + finalText + interimText;
        });
      };
      recognition.start();
      recognitionRef.current = recognition;
    }
  }, []);

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h1 className="text-lg font-semibold text-white">Mock Technical Interview</h1>
          <Link href="/prepare" className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">Exit</Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6 text-center">
            <p className="text-zinc-300">
              You will have <strong className="text-white">15 minutes</strong> to solve one coding problem. Explain your approach and reasoning out loud while you code. Your explanation will be transcribed and used to evaluate your reasoning.
            </p>
            <p className="mt-4 text-sm text-zinc-500">No webcam — focus on the problem and your explanation.</p>
            <button
              type="button"
              onClick={startCoding}
              className="mt-6 rounded-xl bg-cyan-500 px-8 py-3 text-base font-semibold text-white hover:bg-cyan-400"
            >
              Start (15 min)
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "coding") {
    return (
      <div className="flex h-screen flex-col bg-zinc-950 overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {company && <TechnicalInterviewLogo company={company} />}
              <h1 className="text-lg font-semibold text-white truncate">
                Mock Technical Interview{company ? ` | ${company}` : ""}
              </h1>
            </div>
            <span className={`rounded-lg px-3 py-1 text-sm font-mono font-medium ${timeLeftMs < 60000 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-700 text-zinc-300"}`}>
              {formatTime(timeLeftMs)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
            >
              Submit
            </button>
            <Link href="/prepare" className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">Exit</Link>
          </div>
        </header>
        <div className="flex flex-1 min-h-0 gap-px bg-zinc-800">
          <div className="flex flex-col w-1/2 min-w-0 overflow-hidden">
            <div className="shrink-0 border-b border-zinc-700 bg-zinc-800/80 px-4 py-2">
              <h2 className="text-sm font-semibold text-white">Problem</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">{EXAMPLE_PROBLEM.title}</h3>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">{EXAMPLE_PROBLEM.description}</div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap border-t border-zinc-700 pt-3">{EXAMPLE_PROBLEM.examples}</div>
              <div className="text-xs text-zinc-500 whitespace-pre-wrap border-t border-zinc-700 pt-3">{EXAMPLE_PROBLEM.constraints}</div>
            </div>
            <div className="shrink-0 p-2">
              <div
                className="rounded-xl border-2 bg-zinc-800/80 p-3 transition-[border-color] duration-500 ease-linear"
                style={{
                  borderColor: `rgba(113, 113, 122, ${Math.max(0, timeLeftMs / TIME_LIMIT_MS)})`,
                }}
              >
                <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wide">Live transcription</p>
                <div className="min-h-[4rem] max-h-28 overflow-y-auto text-sm text-zinc-300 whitespace-pre-wrap">
                  {transcript || "(Start speaking to see your explanation here…)"}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col w-1/2 min-w-0 overflow-hidden">
            <div className="shrink-0 border-b border-zinc-700 bg-zinc-800/80 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-white">Code (Python)</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={runPending}
                  onClick={async () => {
                    setRunPending(true);
                    setRunResult(null);
                    try {
                      const res = await fetch("/api/run-python", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code }),
                      });
                      const data = await res.json();
                      setRunResult({
                        passed: data.passed,
                        results: data.results,
                        stdout: data.stdout ?? "",
                        stderr: data.stderr ?? "",
                      });
                    } catch (e) {
                      setRunResult({
                        passed: false,
                        results: [
                          { nums: [], target: 0, expected: [], got: null, passed: false, error: e instanceof Error ? e.message : "Request failed" },
                        ],
                        stdout: "",
                        stderr: e instanceof Error ? e.message : "Request failed",
                      });
                    } finally {
                      setRunPending(false);
                    }
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {runPending ? "Running…" : "Run"}
                </button>
                <span className="text-xs text-zinc-500">Explain your approach out loud — audio is being recorded</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 w-full resize-none bg-zinc-900 p-4 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                spellCheck={false}
                placeholder="# Write your Python solution (def two_sum(nums, target): ...)"
              />
              {runResult && (
                <div className={`shrink-0 border-t px-4 py-3 ${runResult.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                  {runResult.passed ? (
                    <p className="text-sm font-medium text-emerald-400">All tests passed.</p>
                  ) : (
                    <div className="text-sm">
                      <p className="font-medium text-amber-400 mb-2">Some tests failed:</p>
                      <ul className="space-y-1.5">
                        {runResult.results.map((r, i) => (
                          <li key={i} className={r.passed ? "text-zinc-400" : "text-amber-200"}>
                            {r.passed ? (
                              <span>Test {i + 1}: passed</span>
                            ) : (
                              <span>
                                Test {i + 1}: nums={JSON.stringify(r.nums)}, target={r.target} — expected {JSON.stringify(r.expected)}
                                {r.got != null ? `, got ${JSON.stringify(r.got)}` : ""}
                                {r.error ? ` (${r.error})` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <details className="shrink-0 border-t border-zinc-700 bg-zinc-800/50" open>
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300">Terminal</summary>
                <div className="bg-zinc-950 border-t border-zinc-700 font-mono text-xs text-zinc-300 overflow-x-auto overflow-y-auto min-h-[4rem] max-h-40 px-4 py-3 whitespace-pre-wrap break-all">
                  {runResult != null ? (
                    <>
                      {runResult.stdout ? <span className="text-zinc-300">{runResult.stdout}</span> : null}
                      {runResult.stderr ? (
                        <span className="block mt-1 text-red-400">{runResult.stderr}</span>
                      ) : null}
                      {!runResult.stdout && !runResult.stderr ? (
                        <span className="text-zinc-500">(No stdout/stderr)</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-zinc-500">Click Run to see output.</span>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      Submitting…
    </div>
  );
}

export default function InterviewTechnicalPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>}>
      <InterviewTechnicalContent />
    </Suspense>
  );
}
