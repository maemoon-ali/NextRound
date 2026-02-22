"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { JobHistoryForm } from "@/components/JobHistoryForm";
import { WaveformLogo } from "@/components/WaveformLogo";
import type { UserJobEntry } from "@/lib/livedata-types";
import type { MatchResult } from "@/lib/match";
import { getBookmarks, removeBookmark, roleQueryString } from "@/lib/bookmarks";
import { getAllAttempts, type InterviewAttempt } from "@/lib/attempts";
import { getResponseAnalysisForQuestion } from "@/lib/response-analysis";

const KEY_POINTS_TECHNICAL = [
  { id: "approach", label: "State your approach or strategy before coding", keywords: ["approach", "strategy", "plan", "first i'll", "going to", "will use"] },
  { id: "complexity", label: "Mention time and space complexity", keywords: ["complexity", "o(n)", "o(1)", "time", "space", "linear", "constant"] },
  { id: "edge", label: "Consider edge cases (empty input, duplicates)", keywords: ["edge", "empty", "duplicate", "zero", "null", "corner"] },
  { id: "steps", label: "Explain your reasoning step by step", keywords: ["step", "first", "then", "next", "because", "so"] },
  { id: "tradeoffs", label: "Discuss tradeoffs if relevant", keywords: ["tradeoff", "trade-off", "instead", "alternative", "could also"] },
];

const BEHAVIORAL_KEY_POINTS = [
  { id: "situation", label: "Situation: Set the scene (when, where, who was involved)", keywords: ["situation", "context", "at the time", "we had", "there was", "back when", "my team", "company"] },
  { id: "task", label: "Task: Your responsibility or goal in that situation", keywords: ["task", "goal", "responsible", "needed to", "had to", "my role", "objective", "challenge"] },
  { id: "action", label: "Action: What you did (steps you took, decisions you made)", keywords: ["action", "i decided", "i led", "i worked", "we did", "i took", "first i", "then i", "so i"] },
  { id: "result", label: "Result: Outcome, impact, or what you learned", keywords: ["result", "outcome", "impact", "learned", "in the end", "as a result", "improved", "reduced", "increased"] },
  { id: "specifics", label: "Specifics: Numbers, names, or concrete details", keywords: ["%", "percent", "number", "weeks", "months", "dollars", "users", "customers", "revenue", "metric"] },
  { id: "reflection", label: "Reflection: What you’d do differently or what it taught you", keywords: ["would do differently", "next time", "taught me", "takeaway", "if i could", "looking back"] },
];

function AttemptReviewCard({
  attempt,
  expanded,
  onToggle,
}: {
  attempt: InterviewAttempt;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dateStr = attempt.date ? new Date(attempt.date).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
  const isTechnical = attempt.interviewType === "technical";
  const transcript0 = (attempt.transcripts[0] ?? "").trim().toLowerCase();
  const missingKeyPoints = isTechnical
    ? KEY_POINTS_TECHNICAL.filter((kp) => !kp.keywords.some((kw) => transcript0.includes(kw)))
    : [];
  function getMissingBehavioral(transcript: string) {
    const t = (transcript ?? "").trim().toLowerCase();
    return !isTechnical ? BEHAVIORAL_KEY_POINTS.filter((kp) => !kp.keywords.some((kw) => t.includes(kw))) : [];
  }

  return (
    <div className="rounded-xl border-2 bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 border-zinc-500/40 p-4">
      <div className="flex gap-3">
        <CompanyLogo name={attempt.company} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{attempt.role}</p>
          <p className="text-sm text-zinc-300">{attempt.company}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{dateStr} · {isTechnical ? "Technical" : "Behavioral"}</p>
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
          >
            {expanded ? "Hide review" : "Review transcript & notes"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-600 space-y-4">
          {attempt.questions.map((q, i) => {
            const t = attempt.transcripts[i] ?? "";
            const words = t.trim().split(/\s+/).filter(Boolean).length;
            return (
              <div key={i} className="rounded-lg border border-zinc-600 bg-zinc-800/50 p-3">
                <p className="text-xs text-zinc-500">Question {i + 1}</p>
                <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{q}</p>
                <p className="mt-2 text-xs text-zinc-500">Your response ({words} words)</p>
                <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">{t.trim() || "(No speech captured)"}</p>
                {(() => {
                  const analysis = getResponseAnalysisForQuestion(q, isTechnical);
                  return (
                    <div className="mt-3 space-y-3">
                      {attempt.scores[i] != null && (
                        <p className="text-xs text-zinc-500">
                          Response score: {Math.round((attempt.scores[i]?.responseScore ?? 0) * 100)}% · Tone: {Math.round((attempt.scores[i]?.toneScore ?? 0) * 100)}%
                        </p>
                      )}
                      {analysis.map((sec, si) => (
                        <div key={si} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                          <p className="text-xs font-medium text-amber-400/90 mb-2">{sec.title}</p>
                          <ul className="text-xs text-zinc-400 space-y-1">
                            {sec.items.map((item, ii) => (
                              <li key={ii}>· {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {!isTechnical && getMissingBehavioral(attempt.transcripts[i] ?? "").length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                          <p className="text-xs font-medium text-amber-400/90 mb-1">Consider adding in this answer</p>
                          <ul className="text-xs text-zinc-400 space-y-1">
                            {getMissingBehavioral(attempt.transcripts[i] ?? "").map((kp) => (
                              <li key={kp.id}>· {kp.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isTechnical && missingKeyPoints.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                          <p className="text-xs font-medium text-amber-400/90 mb-1">Key points you may be missing</p>
                          <ul className="text-xs text-zinc-400 space-y-1">
                            {missingKeyPoints.map((kp) => (
                              <li key={kp.id}>· {kp.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isTechnical && missingKeyPoints.length === 0 && (
                        <p className="text-xs text-emerald-400/90">You touched on all suggested areas.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompanyLogo({ name }: { name: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || "?").trim().slice(0, 2).toUpperCase() || "?";
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const boxClass = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-lg font-bold";
  const logoSrc = name?.trim() ? `/api/logo?company=${encodeURIComponent(name.trim())}` : "";
  if (logoSrc && !imgFailed) {
    return (
      <div className={boxClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={boxClass} style={{ color: `hsl(${hue}, 55%, 45%)` }}>
      {initial}
    </div>
  );
}

function MatchInfoCard({ reasons, score }: { reasons: string[]; score: number }) {
  const [open, setOpen] = useState(false);
  const list = reasons?.length ? reasons : ["Matched to your career pathway based on your job history."];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-500 bg-zinc-700/80 text-zinc-300 hover:bg-zinc-600 hover:text-white"
        title="Why this match?"
        aria-label="Why this match?"
      >
        <span className="text-sm font-semibold">i</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[260px] max-w-[320px] rounded-lg border border-zinc-600 bg-zinc-800 p-3 shadow-xl">
            <p className="mb-2 text-xs font-medium text-emerald-400">Why this job was matched</p>
            <p className="mb-2 text-xs text-zinc-400">
              Match strength: {Math.round(score * 100)}% — based on your job history and LiveDataTechnologies workforce patterns.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-zinc-300">
              {list.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

type Tab = "recommended" | "saved" | "attempted";

export default function Prepare() {
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recommended");
  const [savedList, setSavedList] = useState(() => getBookmarks());
  const [attemptedList, setAttemptedList] = useState<InterviewAttempt[]>(() => getAllAttempts());
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "saved") setSavedList(getBookmarks());
    if (tab === "attempted") setAttemptedList(getAllAttempts());
  }, [tab]);

  useEffect(() => {
    if (tab === "saved") {
      const onVisible = () => setSavedList(getBookmarks());
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
    if (tab === "attempted") {
      const onVisible = () => setAttemptedList(getAllAttempts());
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
  }, [tab]);

  async function handleSubmit(jobHistory: UserJobEntry[]) {
    setLoading(true);
    setMatches(null);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_history: jobHistory }),
        cache: "no-store",
      });
      let data: { matches?: unknown[]; error?: string } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text) as { matches?: unknown[]; error?: string };
      } catch {
        setError(res.ok ? "Invalid response from server." : `Request failed (${res.status}). Please try again.`);
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "Match failed. Please try again.");
        return;
      }
      const list = Array.isArray(data.matches) ? (data.matches as MatchResult[]) : [];
      setMatches(list);
      if (list.length === 0) {
        setError("No similar roles found. Try different job titles or companies.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-emerald-500/20 bg-gradient-to-r from-zinc-900/90 to-emerald-950/20">
        <div className="mx-auto max-w-4xl px-4 py-4 text-center">
          <h1 className="text-xl font-semibold text-white font-brand">
            NextRound
          </h1>
          <div className="mt-1 flex items-center justify-center gap-3">
            <WaveformLogo variant="compact" />
            <p className="text-sm text-emerald-200/70">
              Powered by LiveDataTechnologies workforce data
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <section className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-zinc-800/80 to-emerald-950/30 p-6 shadow-lg shadow-emerald-500/5">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-emerald-400" />
            Your job history
          </h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            Enter your roles so we can recommend jobs related to your career pathway.
          </p>
          <JobHistoryForm onSubmit={handleSubmit} loading={loading} variant="vibrant" />
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-6 rounded-2xl border-2 border-emerald-500/20 bg-emerald-950/20 p-6 text-center text-emerald-200">
            <span className="inline-block animate-pulse">Finding roles for your career pathway…</span>
          </div>
        )}

        {(matches?.length ?? 0) > 0 || savedList.length > 0 || attemptedList.length > 0 ? (
          <section className="mt-8 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-zinc-800/80 to-emerald-950/20 p-6 shadow-lg shadow-emerald-500/5">
            <div className="flex gap-2 border-b border-zinc-600/80 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setTab("recommended")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "recommended"
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                Recommended
              </button>
              <button
                type="button"
                onClick={() => setTab("saved")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "saved"
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                Saved {savedList.length > 0 ? `(${savedList.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setTab("attempted")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "attempted"
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                Attempted {attemptedList.length > 0 ? `(${attemptedList.length})` : ""}
              </button>
            </div>

            {tab === "attempted" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {attemptedList.length === 0 ? (
                  <p className="col-span-2 text-sm text-zinc-500 py-4">
                    No attempted interviews yet. Complete a mock or technical interview from a role page to see them here.
                  </p>
                ) : (
                  attemptedList.map((attempt) => (
                    <div
                      key={attempt.id}
                      className={expandedAttemptId === attempt.id ? "sm:col-span-2" : ""}
                    >
                      <AttemptReviewCard
                        attempt={attempt}
                        expanded={expandedAttemptId === attempt.id}
                        onToggle={() => setExpandedAttemptId((id) => (id === attempt.id ? null : attempt.id))}
                      />
                    </div>
                  ))
                )}
              </div>
            ) : tab === "saved" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {savedList.length === 0 ? (
                  <p className="col-span-2 text-sm text-zinc-500 py-4">
                    No saved roles yet. Open a role and click the bookmark to add it here.
                  </p>
                ) : (
                  savedList.map((b) => (
                    <div
                      key={`${b.company}-${b.role}`}
                      className="rounded-xl border-2 bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 border-zinc-500/40 p-4"
                    >
                      <div className="flex gap-3">
                        <CompanyLogo name={b.company} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{b.role}</p>
                          <p className="text-sm text-zinc-300">{b.company}</p>
                          {b.location && <p className="text-xs text-zinc-500 mt-0.5">{b.location}</p>}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                removeBookmark(b.company, b.role);
                                setSavedList(getBookmarks());
                              }}
                              className="text-xs text-zinc-500 hover:text-red-400"
                            >
                              Remove
                            </button>
                            <Link
                              href={`/role?${roleQueryString(b)}`}
                              className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-400/60 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              title="View role details"
                            >
                              <span className="text-lg font-bold">→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {!matches || matches.length === 0 ? (
                <p className="col-span-2 text-sm text-zinc-500 py-4">
                  Submit your job history above to see recommended roles.
                </p>
              ) : matches.map((m, i) => {
                const colors = [
                  "from-emerald-500/20 to-teal-500/20 border-emerald-400/40",
                  "from-violet-500/20 to-purple-500/20 border-violet-400/40",
                  "from-amber-500/20 to-orange-500/20 border-amber-400/40",
                  "from-rose-500/20 to-pink-500/20 border-rose-400/40",
                  "from-cyan-500/20 to-sky-500/20 border-cyan-400/40",
                ];
                const style = colors[i % colors.length];
                const pct = Math.round(m.score * 100);
                return (
                  <div
                    key={m.person.id}
                    className={`rounded-xl border-2 bg-gradient-to-br ${style} p-4`}
                  >
                    <div className="flex gap-3">
                      <CompanyLogo name={m.person.current_position.company.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">
                              {m.suggestedRole}
                            </p>
                            <p className="text-sm text-zinc-300">
                              {m.person.current_position.company.name}
                            </p>
                            {m.person.current_position.location && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {m.person.current_position.location}
                              </p>
                            )}
                          </div>
                          <MatchInfoCard reasons={m.matchReasons ?? []} score={m.score} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                              pct >= 70
                                ? "bg-emerald-500/25 text-emerald-300"
                                : pct >= 50
                                  ? "bg-amber-500/25 text-amber-300"
                                  : "bg-red-500/25 text-red-300"
                            }`}
                          >
                            {pct}% match
                          </span>
                          <Link
                            href={`/role?company=${encodeURIComponent(m.person.current_position.company.name)}&role=${encodeURIComponent(m.suggestedRole)}&location=${encodeURIComponent(m.person.current_position.location ?? "")}&function=${encodeURIComponent(m.suggestedFunction)}&level=${encodeURIComponent(m.suggestedLevel)}&reasons=${encodeURIComponent(JSON.stringify(m.matchReasons ?? []))}&score=${encodeURIComponent(String(m.score))}`}
                            className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-400/60 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:border-emerald-400"
                            title="View role details"
                            aria-label="View role details"
                          >
                            <span className="text-lg font-bold">→</span>
                          </Link>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400 italic">
                          {m.suggestedFunction.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
