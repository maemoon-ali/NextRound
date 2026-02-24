"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import type { QuestionScore } from "@/components/InterviewRoom";
import { saveAttempt } from "@/lib/attempts";
import { getResponseAnalysisForQuestion } from "@/lib/response-analysis";

interface StoredResults {
  company?: string;
  role: string;
  scores: QuestionScore[];
  questions?: string[];
  transcripts?: string[];
  interviewType?: string;
}

interface AnalysisResult {
  overall: string;
  summary: string;
  overall_score: number;
  per_question: Array<{
    question_index: number;
    question: string;
    transcript: string;
    feedback: string;
    score: number;
  }>;
}

const METRIC_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ec4899"];

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredResults | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("interviewResults");
      if (!raw) {
        router.replace("/");
        return;
      }
      const parsed = JSON.parse(raw) as StoredResults;
      setData(parsed);
      // Persist this run as an attempt for the Attempted tab (by company)
      const company = parsed.company ?? "";
      if (company && parsed.questions?.length) {
        saveAttempt({
          company,
          role: parsed.role,
          interviewType: (parsed.interviewType === "technical" ? "technical" : "behavioral") as "technical" | "behavioral",
          questions: parsed.questions,
          transcripts: parsed.transcripts ?? [],
          scores: parsed.scores,
        });
      }

      // Call analyze API to get feedback on responses
      if (parsed.questions?.length && parsed.transcripts?.length) {
        setAnalysisLoading(true);
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions: parsed.questions,
            transcripts: parsed.transcripts,
          }),
        })
          .then((res) => res.json())
          .then((result: AnalysisResult) => {
            setAnalysis(result);
            setAnalysisLoading(false);
          })
          .catch(() => {
            setAnalysisLoading(false);
          });
      } else {
        setAnalysisLoading(false);
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading results…
      </div>
    );
  }

  const { role, scores, questions = [], transcripts = [], interviewType } = data;
  const isTechnical = interviewType === "technical";
  const anySpeech = transcripts.some((t) => (t ?? "").trim().length >= 10);

  const avgEye = average(scores.map((s) => s.eyeContactScore));
  const avgTone = average(scores.map((s) => s.toneScore));
  const avgResponse = average(scores.map((s) => s.responseScore));
  const avgSpeak = average(scores.map((s) => s.speakingTimeRatio));
  // Tone should have some influence but not dominate the overall score.
  const overall =
    isTechnical
      ? avgResponse
      : avgEye * 0.3 + avgResponse * 0.4 + avgSpeak * 0.2 + avgTone * 0.1;

  // For display, avoid showing 0% tone if the user clearly spoke.
  const spokeOnAnyQuestion = scores.some((s) => s.speakingTimeRatio > 0.15);
  const displayTone = !isTechnical && spokeOnAnyQuestion && avgTone < 0.2 ? 0.2 : avgTone;

  const barData = scores.map((s, i) => ({
    name: `Q${i + 1}`,
    "Eye contact": Math.round(s.eyeContactScore * 100),
    Tone: Math.round(s.toneScore * 100),
    "Response (content)": Math.round(s.responseScore * 100),
    "Speaking %": Math.round(s.speakingTimeRatio * 100),
  }));

  const radarData = [
    { metric: "Eye contact", value: Math.round(avgEye * 100), fullMark: 100 },
    { metric: "Tone", value: Math.round(displayTone * 100), fullMark: 100 },
    { metric: "Response quality", value: Math.round(avgResponse * 100), fullMark: 100 },
    { metric: "Speaking time", value: Math.round(avgSpeak * 100), fullMark: 100 },
  ];

  const timePerQuestion = scores.map((s, i) => ({
    name: `Q${i + 1}`,
    seconds: Math.round(s.timeUsedMs / 1000),
  }));

  const transcript = (transcripts[0] ?? "").trim().toLowerCase();
  const keyPointsTechnical = [
    { id: "approach", label: "State your approach or strategy before coding", keywords: ["approach", "strategy", "plan", "first i'll", "going to", "will use"] },
    { id: "complexity", label: "Mention time and space complexity", keywords: ["complexity", "o(n)", "o(1)", "time", "space", "linear", "constant"] },
    { id: "edge", label: "Consider edge cases (empty input, duplicates)", keywords: ["edge", "empty", "duplicate", "zero", "null", "corner"] },
    { id: "steps", label: "Explain your reasoning step by step", keywords: ["step", "first", "then", "next", "because", "so"] },
    { id: "tradeoffs", label: "Discuss tradeoffs if relevant", keywords: ["tradeoff", "trade-off", "instead", "alternative", "could also"] },
  ];
  const missingKeyPoints = keyPointsTechnical.filter(
    (kp) => !kp.keywords.some((kw) => transcript.includes(kw))
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Interview results
            </h1>
            <p className="text-sm text-zinc-400">Role: {role}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            New practice
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Overall score */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-lg font-medium text-white">Overall score</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {isTechnical
              ? "Based solely on your response (reasoning and explanation)."
              : "Based on your transcript (response content), tone, eye contact, and speaking time per question."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-8">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-emerald-500/50 bg-emerald-500/10">
              <span className="text-4xl font-bold tabular-nums text-white">
                {Math.round(overall * 100)}%
              </span>
            </div>
            {!isTechnical && (
              <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-base sm:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-zinc-400">Eye contact</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{Math.round(avgEye * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-400">Tone</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{Math.round(displayTone * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-400">Response</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{Math.round(avgResponse * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-400">Speaking time</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{Math.round(avgSpeak * 100)}%</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Key points you may be missing (technical only) — replaces metrics overview */}
        {isTechnical && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="text-lg font-medium text-white">Key points you may be missing</h2>
            <p className="mt-1 text-xs text-zinc-500">Consider adding these to strengthen your technical explanations.</p>
            {missingKeyPoints.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {missingKeyPoints.map((kp) => (
                  <li key={kp.id} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{kp.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-emerald-400/90">You touched on all suggested areas in your response.</p>
            )}
          </section>
        )}

        {/* Radar — non-technical only */}
        {!isTechnical && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="text-lg font-medium text-white">Metrics overview</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "#e4e4e7", fontSize: 13, fontWeight: 500 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "#a1a1aa", fontSize: 14 }}
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Overall analysis feedback */}
        {analysis && !analysisLoading && anySpeech && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="text-lg font-medium text-white">Overall feedback</h2>
            <p className="mt-1 text-xs text-zinc-500">
              AI-powered analysis of your interview performance including content quality and speech delivery.
            </p>
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{analysis.summary}</p>
              <p className="mt-3 text-xs text-zinc-400">
                Overall score: {Math.round(analysis.overall_score * 100)}% ({analysis.overall === "good" ? "Good" : analysis.overall === "needs_work" ? "Needs work" : "Poor"})
              </p>
            </div>
          </section>
        )}

        {/* Response analysis — from actual transcript only */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-lg font-medium text-white">Response analysis</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {isTechnical
              ? "Your spoken explanation with AI feedback. Below, notes on where to add more in future technical answers."
              : "AI-powered feedback on your actual responses, including content quality, speech delivery (filler words, stuttering, pauses), and suggestions for improvement."}
          </p>
          {analysisLoading && (
            <div className="mt-4 text-center py-8 text-zinc-400">
              Analyzing your responses...
            </div>
          )}
          {questions.length > 0 && !analysisLoading && (
            <div className="mt-4 space-y-3">
              {questions.map((q, i) => {
                const raw = transcripts[i] ?? "";
                // Treat pure "(long pause)" style transcripts as no speech.
                const withoutPauseMarkers = raw.replace(/\(long pause\)/gi, "").trim();
                const words = withoutPauseMarkers.split(/\s+/).filter(Boolean).length;
                const hasSpeech = withoutPauseMarkers.length >= 10 && words >= 2;
                const t = raw;
                const questionAnalysis = analysis?.per_question.find((aq) => aq.question_index === i);
                
                return (
                  <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                    <p className="text-xs text-zinc-500">Q{i + 1}: {q}</p>
                    <p className="mt-1.5 text-sm text-zinc-300">
                      {hasSpeech ? (
                        <>
                          Your answer ({words} word{words !== 1 ? "s" : ""}): &ldquo;{t.trim() || "(no speech captured)"}&rdquo;
                        </>
                      ) : (
                        <span className="text-zinc-500">No speech captured.</span>
                      )}
                    </p>

                    {/* AI Feedback / No speech box */}
                    <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-blue-400/90 mb-2">
                        {hasSpeech && questionAnalysis && questionAnalysis.feedback
                          ? `AI Feedback (Score: ${Math.round(questionAnalysis.score * 100)}%)`
                          : "No speech captured for this question"}
                      </p>
                      <p className="text-sm text-zinc-100 whitespace-pre-wrap">
                        {hasSpeech && questionAnalysis && questionAnalysis.feedback
                          ? questionAnalysis.feedback
                          : "We couldn’t hear an answer here, so tone and response scores for this question are 0. On your next try, speak your full answer out loud so we can analyze it."}
                      </p>
                    </div>

                    {/* What you should have said (static guidance) */}
                    {(() => {
                      const staticAnalysis = getResponseAnalysisForQuestion(q, isTechnical);
                      return staticAnalysis.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          <p className="text-xs font-medium text-amber-400/90">What to include in future answers:</p>
                          {staticAnalysis.map((sec, si) => (
                            <div key={si} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                              <p className="text-xs font-medium text-amber-400/90 mb-2">{sec.title}</p>
                              <ul className="space-y-1.5 text-sm text-zinc-300">
                                {sec.items.map((item, ii) => (
                                  <li key={ii}><span className="text-zinc-500">•</span> {item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Per-question bars — non-technical only */}
        {!isTechnical && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="text-lg font-medium text-white">
              Scores by question
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#a1a1aa" }}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#71717a" }}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#27272a",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Legend />
                  <Bar dataKey="Eye contact" fill={METRIC_COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tone" fill={METRIC_COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Response (content)" fill={METRIC_COLORS[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Speaking %" fill={METRIC_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Time per question — non-technical only */}
        {!isTechnical && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="text-lg font-medium text-white">
              Time per question (seconds)
            </h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timePerQuestion} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#a1a1aa" }}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <YAxis
                    tick={{ fill: "#71717a" }}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#27272a",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="seconds" fill="#10b981" radius={[4, 4, 0, 0]} name="Seconds" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Max 120 seconds (2 min) per question.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
