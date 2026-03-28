"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { JobHistoryForm } from "@/components/JobHistoryForm";
import { NextRoundSidebar, type SidebarSection } from "@/components/ui/sidebar-component";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { FrostedGlassCard } from "@/components/ui/interactive-frosted-glass-card";
import type { UserJobEntry, UserEducationEntry } from "@/lib/livedata-types";
import type { MatchResult } from "@/lib/match";
import { getBookmarks, saveBookmark, removeBookmark, isBookmarked, roleQueryString } from "@/lib/bookmarks";
import { getAllAttempts, type InterviewAttempt } from "@/lib/attempts";
import { getResponseAnalysisForQuestion } from "@/lib/response-analysis";
import { CompanyLogo } from "@/components/ui/company-logo";
import { InterviewSearch, type InterviewRole } from "@/components/InterviewSearch";
import { CareerTimeline, type TimelineStep } from "@/components/ui/career-timeline";
import { HoverTextGlow } from "@/components/ui/hover-text-glow";

// ── Key-point checklists ─────────────────────────────────────────────────────
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
  { id: "reflection", label: "Reflection: What you'd do differently or what it taught you", keywords: ["would do differently", "next time", "taught me", "takeaway", "if i could", "looking back"] },
];

// ── Sub-components ────────────────────────────────────────────────────────────

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
    <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.06] border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex gap-3">
        <CompanyLogo name={attempt.company} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white text-sm">{attempt.role}</p>
          <p className="text-xs text-zinc-400">{attempt.company}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{dateStr} · {isTechnical ? "Technical" : "Behavioral"}</p>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
          >
            {expanded ? "Hide review" : "Review transcript & notes"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-700/50 space-y-4">
          {attempt.questions.map((q, i) => {
            const t = attempt.transcripts[i] ?? "";
            const words = t.trim().split(/\s+/).filter(Boolean).length;
            return (
              <div key={i} className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3">
                <p className="text-xs text-zinc-600">Question {i + 1}</p>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{q}</p>
                <p className="mt-2 text-xs text-zinc-600">Your response ({words} words)</p>
                <p className="mt-1 text-xs text-zinc-300 whitespace-pre-wrap">{t.trim() || "(No speech captured)"}</p>
                {(() => {
                  const analysis = getResponseAnalysisForQuestion(q, isTechnical);
                  return (
                    <div className="mt-3 space-y-2">
                      {attempt.scores[i] != null && (
                        <p className="text-xs text-zinc-500">
                          Response: {Math.round((attempt.scores[i]?.responseScore ?? 0) * 100)}% · Tone: {Math.round((attempt.scores[i]?.toneScore ?? 0) * 100)}%
                        </p>
                      )}
                      {analysis.map((sec, si) => (
                        <div key={si} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                          <p className="text-xs font-medium text-amber-400/90 mb-1.5">{sec.title}</p>
                          <ul className="text-xs text-zinc-400 space-y-0.5">
                            {sec.items.map((item, ii) => <li key={ii}>· {item}</li>)}
                          </ul>
                        </div>
                      ))}
                      {!isTechnical && getMissingBehavioral(attempt.transcripts[i] ?? "").length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                          <p className="text-xs font-medium text-amber-400/90 mb-1">Consider adding in this answer</p>
                          <ul className="text-xs text-zinc-400 space-y-0.5">
                            {getMissingBehavioral(attempt.transcripts[i] ?? "").map((kp) => (
                              <li key={kp.id}>· {kp.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isTechnical && missingKeyPoints.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                          <p className="text-xs font-medium text-amber-400/90 mb-1">Key points you may be missing</p>
                          <ul className="text-xs text-zinc-400 space-y-0.5">
                            {missingKeyPoints.map((kp) => <li key={kp.id}>· {kp.label}</li>)}
                          </ul>
                        </div>
                      )}
                      {isTechnical && missingKeyPoints.length === 0 && (
                        <p className="text-xs text-emerald-400/80">✓ You touched on all suggested areas.</p>
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


// ── Hold-to-save card wrapper ─────────────────────────────────────────────────
const HOLD_MS = 1500;

interface HoldState {
  phase: "idle" | "holding" | "success";
  progress: number;
  /** Call inside onClick — returns true if a hold just completed (navigation should be suppressed). */
  cancelClick: () => boolean;
}

function HoldToSaveCard({
  onSaved,
  alreadySaved,
  children,
}: {
  onSaved: () => void;
  alreadySaved: boolean;
  children: (state: HoldState) => React.ReactNode;
}) {
  const [phase, setPhase] = useState<"idle" | "holding" | "success">("idle");
  const [progress, setProgress] = useState(0);
  const holdingRef = useRef(false);
  const justSavedRef = useRef(false);   // stays true until click event fires after a completed hold
  const rafRef = useRef<number | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef(0);

  useEffect(() => () => {
    holdingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  function startHold() {
    if (alreadySaved || holdingRef.current || phase === "success") return;
    holdingRef.current = true;
    setPhase("holding");
    setProgress(0);
    startRef.current = performance.now();
    function tick() {
      if (!holdingRef.current) return;
      const p = Math.min((performance.now() - startRef.current) / HOLD_MS, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        complete();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPhase("idle");
    setProgress(0);
  }

  function complete() {
    holdingRef.current = false;
    justSavedRef.current = true;   // block the imminent onClick from navigating
    setPhase("success");
    setProgress(1);
    onSaved();
    successTimerRef.current = setTimeout(() => {
      setPhase("idle");
      setProgress(0);
    }, 2200);
  }

  /** Returns true (and resets the flag) when a hold just completed — use to skip navigation in onClick. */
  function cancelClick(): boolean {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      return true;
    }
    return false;
  }

  return (
    <div
      className="relative select-none h-full"
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
    >
      {children({ phase, progress, cancelClick })}
    </div>
  );
}

function MatchInfoCard({ reasons, score }: { reasons: string[]; score: number }) {
  const [open, setOpen] = useState(false);
  // visible: starts hidden so we can measure position before showing
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pct = Math.round(score * 100);

  // Build reason list — tailored messaging for weak matches
  const baseList = reasons?.length ? reasons : [];
  const list = [...baseList];
  if (pct < 60 && list.length < 4) {
    list.push("This is the closest available match — your background may point toward a different field or level than what's in the dataset right now");
  }
  if (pct < 45) {
    list.unshift("Limited overlap found with your profile. Try adding more job history entries with different titles or companies to improve match quality");
  }
  if (pct < 30) {
    list.unshift("This role has very low alignment with your profile — it may still be worth exploring, but consider it a stretch opportunity");
  }
  if (!list.length) {
    list.push("Matched to your career pathway based on LiveData workforce patterns");
  }

  function toggle() {
    if (open) {
      setOpen(false);
      setVisible(false);
      return;
    }
    if (btnRef.current) {
      // Compute a provisional position; useLayoutEffect will correct after render
      const r = btnRef.current.getBoundingClientRect();
      const popupW = 300;
      const left = Math.max(8, Math.min(r.right - popupW, window.innerWidth - popupW - 8));
      setPos({ top: r.bottom + 8, left });
      setVisible(false); // hide until layout effect positions it correctly
      setOpen(true);
    }
  }

  // After popup renders (synchronously before paint), correct position so it never overflows
  useLayoutEffect(() => {
    if (!open || !popupRef.current || !btnRef.current) return;
    const popup = popupRef.current.getBoundingClientRect();
    const btn   = btnRef.current.getBoundingClientRect();
    const popupW = 300;
    const MARGIN = 8;

    // Horizontal: clamp so popup doesn't leave viewport
    let left = Math.max(MARGIN, Math.min(btn.right - popupW, window.innerWidth - popupW - MARGIN));

    // Vertical: prefer below; flip above if not enough room
    const spaceBelow = window.innerHeight - btn.bottom - MARGIN;
    const spaceAbove = btn.top - MARGIN;
    let top: number;
    if (popup.height <= spaceBelow) {
      top = btn.bottom + MARGIN;
    } else if (popup.height <= spaceAbove) {
      top = btn.top - popup.height - MARGIN;
    } else {
      // Not enough room either way — anchor to whichever side has more space, clamp to viewport
      if (spaceBelow >= spaceAbove) {
        top = btn.bottom + MARGIN;
      } else {
        top = Math.max(MARGIN, btn.top - popup.height - MARGIN);
      }
    }
    // Hard clamp: never go above top or below bottom of viewport
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - popup.height - MARGIN));

    setPos({ top, left });
    setVisible(true); // now safe to show
  }, [open]);

  const isLowMatch = pct < 60;
  const isVeryLow  = pct < 45;

  const accentColor    = isLowMatch ? "rgb(251,191,36)"        : "rgb(52,211,153)";
  const accentBg       = isLowMatch ? "rgba(251,191,36,0.12)"  : "rgba(52,211,153,0.12)";
  const accentBorder   = isLowMatch ? "rgba(251,191,36,0.25)"  : "rgba(52,211,153,0.25)";
  const popupBorder    = isLowMatch ? `1px solid rgba(251,191,36,0.22)` : `1px solid rgba(255,255,255,0.16)`;

  const popup = open && typeof document !== "undefined"
    ? createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => { setOpen(false); setVisible(false); }}
          />
          {/* Popup */}
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: 300,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              borderRadius: 14,
              border: popupBorder,
              padding: "14px 16px 16px",
              background: "rgba(16,18,24,0.99)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.09)",
              // Only show once layout effect has set the correct position
              opacity: visible ? 1 : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {isVeryLow ? "Weak match" : isLowMatch ? "Partial match" : "Why this matched"}
              </p>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: accentBg, color: accentColor, border: `1px solid ${accentBorder}` }}>
                {pct}%
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              {isLowMatch ? "Limited profile overlap found" : "LiveData workforce data"}
            </p>

            {/* Reason bullets */}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {list.map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.55,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: i === 0 && isVeryLow ? "rgba(251,191,36,0.06)" : "transparent",
                    border: i === 0 && isVeryLow ? "1px solid rgba(251,191,36,0.12)" : "1px solid transparent",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 3, fontSize: 9, color: accentColor }}>
                    {isLowMatch ? "◆" : "✦"}
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white text-xs font-semibold transition-colors"
        title="Why this match?"
        aria-label="Why this match?"
      >
        i
      </button>
      {popup}
    </div>
  );
}

// ── Liquid glass helpers ──────────────────────────────────────────────────────
const glassPanel = "relative rounded-2xl overflow-hidden backdrop-blur-2xl border transition-all duration-300";
const glassCard   = "frosted-glass-card relative rounded-xl overflow-hidden backdrop-blur-xl border transition-all duration-300";
const glassPanelStyle = {
  background: "var(--pg-glass)",
  borderColor: "var(--pg-glass-border)",
  boxShadow: "var(--pg-glass-shadow)",
};
const glassCardStyle  = {
  background: "var(--pg-glass)",
  borderColor: "var(--pg-glass-border)",
  boxShadow: "var(--pg-glass-shadow)",
};

// ── Page ─────────────────────────────────────────────────────────────────────
type Tab = "recommended" | "saved" | "attempted" | "timeline";

const SESSION_KEY = "nr_prepare_state";

function saveSession(matches: MatchResult[], schools: string[], page: number) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ matches, schools, page }));
  } catch { /* quota exceeded, ignore */ }
}

function loadSession(): { matches: MatchResult[]; schools: string[]; page: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { matches: MatchResult[]; schools: string[]; page: number };
  } catch { return null; }
}

function PrepareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [userSchools, setUserSchools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recommended");

  // Initialise section from ?section= URL param (e.g. coming back from an interview page)
  const initialSection = (searchParams?.get("section") ?? "matches") as SidebarSection;
  const [activeSection, setActiveSection] = useState<SidebarSection>(
    ["matches", "history", "saved", "progress", "settings", "behavioral", "technical"].includes(initialSection)
      ? initialSection
      : "matches"
  );
  const [recPage, setRecPage] = useState(0); // 0-indexed, max 2 (3 pages)
  const [savedList, setSavedList] = useState<ReturnType<typeof getBookmarks>>([]);
  const [attemptedList, setAttemptedList] = useState<InterviewAttempt[]>([]);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  // ── Career Timeline state ─────────────────────────────────────────────────
  const [tlLinkedinUrl,  setTlLinkedinUrl]  = useState("");
  const [tlDreamRole,    setTlDreamRole]    = useState("");
  const [tlDreamCompany, setTlDreamCompany] = useState("");
  const [tlSteps,        setTlSteps]        = useState<TimelineStep[] | null>(null);
  const [tlPersonName,   setTlPersonName]   = useState<string | undefined>(undefined);
  const [tlLoading,      setTlLoading]      = useState(false);
  const [tlError,        setTlError]        = useState<string | null>(null);

  async function generateTimeline() {
    if (!tlLinkedinUrl.trim() || !tlDreamRole.trim()) return;
    setTlLoading(true);
    setTlError(null);
    setTlSteps(null);
    setTlPersonName(undefined);
    try {
      const res = await fetch("/api/career-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: tlLinkedinUrl.trim(), dreamRole: tlDreamRole.trim(), dreamCompany: tlDreamCompany.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to generate timeline");
      setTlSteps(d.steps);
      setTlPersonName(d.personName);
    } catch (e: any) {
      setTlError(e?.message ?? "Could not generate timeline. Check your LinkedIn URL and try again.");
    } finally {
      setTlLoading(false);
    }
  }

  // Load from localStorage only on the client to avoid SSR hydration mismatch
  // Also restore last match session from sessionStorage (set when navigating to a role page)
  useEffect(() => {
    setSavedList(getBookmarks());
    setAttemptedList(getAllAttempts());
    // Restore matches if React state was wiped (e.g. router cache evicted)
    if (matches === null) {
      const saved = loadSession();
      if (saved && saved.matches.length > 0) {
        setMatches(saved.matches);
        setUserSchools(saved.schools);
        setRecPage(saved.page);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sessionStorage in sync whenever page changes so back-navigation lands on the right page
  useEffect(() => {
    if (matches && matches.length > 0) {
      saveSession(matches, userSchools, recPage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recPage]);

  useEffect(() => {
    if (tab === "saved") setSavedList(getBookmarks());
    if (tab === "attempted") setAttemptedList(getAllAttempts());
  }, [tab]);

  useEffect(() => {
    const onVisible = () => {
      setSavedList(getBookmarks());
      setAttemptedList(getAllAttempts());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function handleSubmit(jobHistory: UserJobEntry[], education: UserEducationEntry[] = []) {
    setLoading(true);
    setMatches(null);
    setError(null);
    setTab("recommended");
    // Clear any previously saved session so stale results don't persist
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    // Save school names so they can be passed to the role detail page
    setUserSchools(education.map((e) => e.school_name).filter(Boolean));
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_history: jobHistory, education }),
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
      const schools = education.map((e) => e.school_name).filter(Boolean);
      setMatches(list);
      setRecPage(0);
      if (list.length > 0) saveSession(list, schools, 0);
      if (list.length === 0) {
        setError("No similar roles found. Try different job titles or companies.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show results panel when there's data, OR when on saved/progress/settings sections
  // (those views show their content directly without needing data to have been generated first)
  const isDataSection = activeSection === "saved" || activeSection === "progress" || activeSection === "settings";
  const showResultsPanel = isDataSection || tab === "timeline" || activeSection === "matches" || (matches?.length ?? 0) > 0 || savedList.length > 0 || attemptedList.length > 0;

  return (
    <div
      className="page-fade-in flex flex-col h-screen overflow-hidden relative"
      style={{ background: "var(--pg-bg)" }}
    >
      {/* ── Full-width header ─────────────────────────────────────────────── */}
      <header className="shrink-0 border-b backdrop-blur-2xl px-6 py-3 flex items-center gap-4 relative z-20" style={{ background: "var(--pg-glass)", borderColor: "var(--pg-glass-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
        {/* Left: branding */}
        <div className="shrink-0">
          <h1 className="text-base font-bold tracking-tight" style={{ color: "var(--pg-text)" }}>NextRound</h1>
          <p className="text-xs font-medium" style={{ color: "var(--pg-text-muted)" }}>Powered by Live Data Technologies</p>
        </div>

        <div className="flex-1" />

        {/* Right: workforce.ai shimmer link */}
        <a
          href="https://www.workforce.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 shimmer-text text-sm select-none cursor-pointer hover:opacity-80 transition-opacity duration-200"
        >workforce.ai</a>
      </header>

      {/* ── Sidebar + main content ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <NextRoundSidebar
          activeTab={tab}
          onTabChange={setTab}
          savedCount={savedList.length}
          attemptedCount={attemptedList.length}
          onActiveSectionChange={setActiveSection}
        />

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Scrollable body */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">

            {/* Interview search — replaces content when behavioral/technical section is active */}
            {(activeSection === "behavioral" || activeSection === "technical") && (
              <InterviewSearch
                embedded
                type={activeSection === "behavioral" ? "behavioral" : "technical"}
                onSelect={(role: InterviewRole) => {
                  const path = activeSection === "behavioral" ? "/interview" : "/interview-technical";
                  router.push(`${path}?company=${encodeURIComponent(role.company)}&role=${encodeURIComponent(role.role)}&function=${encodeURIComponent(role.function)}`);
                }}
              />
            )}

            {/* Job history form — hidden for saved, progress, settings, and interview practice views */}
            {(activeSection === "matches" || activeSection === "history") && (
              <section className={glassPanel + " p-5"} style={glassPanelStyle}>
                {/* Specular highlight */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                  <h2 className="text-base font-bold text-white tracking-tight">Your Job History</h2>
                </div>
                <p className="text-sm text-white/55 mb-4 ml-3.5">
                  Enter your roles to find jobs matching your career pathway
                </p>
                <JobHistoryForm onSubmit={handleSubmit} loading={loading} variant="vibrant" />
              </section>
            )}

            {/* Error */}
            {error && activeSection !== "behavioral" && activeSection !== "technical" && (
              <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-amber-400/[0.08] border border-amber-400/20 p-4 text-sm text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && activeSection !== "behavioral" && activeSection !== "technical" && (
              <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.10] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
                  <span className="size-4 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
                  Finding roles for your career pathway…
                </div>
              </div>
            )}

            {/* Results panel */}
            {showResultsPanel && activeSection !== "behavioral" && activeSection !== "technical" && (
              <section className="space-y-4">

                {/* ── RECOMMENDED ────────────────────────────────────────────── */}
                {tab === "recommended" && activeSection !== "settings" && (() => {
                  const PER_PAGE = 12;
                  const MAX_PAGES = 3;
                  const allMatches = matches ?? [];
                  const capped = allMatches.slice(0, PER_PAGE * MAX_PAGES);
                  const totalPages = Math.min(MAX_PAGES, Math.ceil(capped.length / PER_PAGE));
                  const page = Math.min(recPage, Math.max(0, totalPages - 1));
                  const pageMatches = capped.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

                  return (
                    <div className="space-y-4">
                      {allMatches.length === 0 ? (
                        <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                          <p className="text-sm text-white/40">Submit your job history above to see recommended roles.</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2" style={{ gridAutoRows: "1fr" }}>
                            {pageMatches.map((m) => {
                              const pct = Math.round(m.score * 100);
                              const company = m.person.current_position.company.name;
                              const role = m.suggestedRole;
                              return (
                                <HoldToSaveCard
                                  key={m.person.id}
                                  alreadySaved={isBookmarked(company, role)}
                                  onSaved={() => {
                                    saveBookmark({
                                      company,
                                      role,
                                      location: m.person.current_position.location ?? "",
                                      function: m.suggestedFunction,
                                      level: m.suggestedLevel,
                                      reasons: m.matchReasons ?? [],
                                    });
                                    setSavedList(getBookmarks());
                                  }}
                                >
                                  {({ phase, progress, cancelClick }) => {
                                    const saved = isBookmarked(company, role);
                                    return (
                                    <FrostedGlassCard className={glassCard + " h-full"} style={glassCardStyle}>
                                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

                                      {/* Card body — padding-bottom leaves room for absolute button */}
                                      <div className="flex gap-3 p-4 pb-12">
                                        <CompanyLogo name={company} domain={m.person.current_position.company.domain} />
                                        <div className="min-w-0 flex-1">
                                          {/* Title + info button row */}
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="font-bold text-white text-sm truncate tracking-tight">{role}</p>
                                              {/* Company + saved bookmark inline */}
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <p className="text-xs text-zinc-300 truncate font-medium">{company}</p>
                                                {saved && (
                                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-emerald-400" aria-label="Saved">
                                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                                  </svg>
                                                )}
                                              </div>
                                              {m.person.current_position.location && (
                                                <p className="text-xs text-zinc-500 mt-0.5 truncate">{m.person.current_position.location}</p>
                                              )}
                                            </div>
                                            <MatchInfoCard reasons={m.matchReasons ?? []} score={m.score} />
                                          </div>
                                          {/* Match % + function */}
                                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pct >= 70 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20" : pct >= 50 ? "bg-amber-500/20 text-amber-300 border border-amber-500/20" : "bg-zinc-700/50 text-zinc-400 border border-zinc-600/30"}`}>
                                              {pct}% match
                                            </span>
                                            <span className="text-xs text-zinc-400 font-medium">{m.suggestedFunction.replace("_", " ")}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Arrow button — absolutely pinned to bottom-right */}
                                      <div className="absolute bottom-3 right-3">
                                        {/* Relative wrapper with explicit size so ring + checkmark position correctly */}
                                        <div className="relative w-9 h-9">
                                          <LiquidButton
                                            type="button"
                                            size="icon"
                                            title="Hold to save · Click to view"
                                            className="w-9 h-9"
                                            onClick={() => {
                                              if (cancelClick()) return;
                                              if (matches) saveSession(matches, userSchools, recPage);
                                              router.push(`/role?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&location=${encodeURIComponent(m.person.current_position.location ?? "")}&function=${encodeURIComponent(m.suggestedFunction)}&level=${encodeURIComponent(m.suggestedLevel)}&reasons=${encodeURIComponent(JSON.stringify(m.matchReasons ?? []))}&score=${encodeURIComponent(String(m.score))}&domain=${encodeURIComponent(m.person.current_position.company.domain ?? "")}${userSchools[0] ? `&school=${encodeURIComponent(userSchools[0])}` : ""}`);
                                            }}
                                          >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(52,211,153,0.7)) drop-shadow(0 0 8px rgba(52,211,153,0.4))" }}>
                                              <path d="M5 12h14M13 6l6 6-6 6" stroke="rgb(52,211,153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </LiquidButton>

                                          {/* Circular progress ring */}
                                          {phase === "holding" && (
                                            <>
                                              <div className="pointer-events-none absolute" style={{ inset: -4, borderRadius: "50%", boxShadow: `0 0 ${18 * progress}px rgba(52,211,153,${0.6 * progress})` }} />
                                              <div className="pointer-events-none absolute" style={{ inset: -2, borderRadius: "50%", border: "2px solid transparent", background: `conic-gradient(rgba(52,211,153,0.95) ${progress * 100}%, rgba(255,255,255,0.08) ${progress * 100}%) border-box`, WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "destination-out", maskComposite: "exclude" }} />
                                            </>
                                          )}

                                          {/* Success checkmark — covers the button */}
                                          {phase === "success" && (
                                            <div
                                              className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-emerald-500"
                                              style={{ animation: "nr-fade-in 0.18s ease both" }}
                                            >
                                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6 9 17l-5-5"/>
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </FrostedGlassCard>
                                    );
                                  }}
                                </HoldToSaveCard>
                              );
                            })}
                          </div>

                          {/* ── Page tabs ── */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setRecPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-white/25 transition-all duration-150 disabled:opacity-25 disabled:pointer-events-none"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                              </button>

                              {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setRecPage(i)}
                                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all duration-150 border ${
                                    i === page
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                                      : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {i + 1}
                                </button>
                              ))}

                              <button
                                type="button"
                                onClick={() => setRecPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page === totalPages - 1}
                                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-white/25 transition-all duration-150 disabled:opacity-25 disabled:pointer-events-none"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── SAVED ──────────────────────────────────────────────────── */}
                {tab === "saved" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                      <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--pg-text)" }}>Saved Roles</h2>
                      {savedList.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">{savedList.length}</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2" style={{ gridAutoRows: "1fr" }}>
                    {savedList.length === 0 ? (
                      <div className="col-span-2 relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        <p className="text-sm text-white/40">No saved roles yet. Open a role and bookmark it.</p>
                      </div>
                    ) : (
                      savedList.map((b) => (
                        <FrostedGlassCard
                          key={`${b.company}-${b.role}`}
                          className={glassCard + " h-full"}
                          style={glassCardStyle}
                        >
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

                          {/* Card body — pb-12 leaves room for the absolute arrow button */}
                          <div className="flex gap-3 p-4 pb-12">
                            <CompanyLogo name={b.company} />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white text-sm truncate tracking-tight">{b.role}</p>
                              <p className="text-xs text-zinc-300 font-medium truncate">{b.company}</p>
                              {b.location && <p className="text-xs text-zinc-500 mt-0.5 truncate">{b.location}</p>}
                              {/* Remove button — distinct pill with trash icon */}
                              <button
                                type="button"
                                onClick={() => { removeBookmark(b.company, b.role); setSavedList(getBookmarks()); }}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 transition-all duration-150"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* Arrow button — pinned to bottom-right, same as recommended cards */}
                          <div className="absolute bottom-3 right-3">
                            <div className="relative w-9 h-9">
                              <LiquidButton
                                type="button"
                                size="icon"
                                className="w-9 h-9"
                                title="View role"
                                onClick={() => {
                                  if (matches) saveSession(matches, userSchools, recPage);
                                  router.push(`/role?${roleQueryString(b)}`);
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(52,211,153,0.7)) drop-shadow(0 0 8px rgba(52,211,153,0.4))" }}>
                                  <path d="M5 12h14M13 6l6 6-6 6" stroke="rgb(52,211,153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </LiquidButton>
                            </div>
                          </div>
                        </FrostedGlassCard>
                      ))
                    )}
                    </div>
                  </div>
                )}

                {/* ── ATTEMPTED / MY PROGRESS ────────────────────────────────── */}
                {tab === "attempted" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                      <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--pg-text)" }}>My Progress</h2>
                      {attemptedList.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">{attemptedList.length} sessions</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                    {attemptedList.length === 0 ? (
                      <div className="col-span-2 relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        <p className="text-sm text-white/40">
                          No practice sessions yet. Start a mock interview from any role page.
                        </p>
                      </div>
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
                  </div>
                )}

                {/* ── CAREER TIMELINE ───────────────────────────────────────── */}
                {tab === "timeline" && (
                  <>
                  {/* ── Phase: idle or loading — centered hero ───────────── */}
                  {!tlSteps && (
                    <div style={{
                      minHeight: "80vh",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 14,
                        width: "100%",
                        maxWidth: 560,
                        padding: "0 20px",
                      }}>

                        {/* Heading */}
                        <div style={{ textAlign: "center", width: "100%" }}>
                          {/* Animated hover-glow heading */}
                          <div style={{ height: 110, width: "100%" }}>
                            <HoverTextGlow text="Timeline" duration={0.22} />
                          </div>
                          <p style={{
                            marginTop: 28, marginBottom: 32, fontSize: 15, fontWeight: 300,
                            color: "rgba(255,255,255,0.38)", lineHeight: 1.5,
                            fontFamily: "var(--font-sora), sans-serif",
                            letterSpacing: "0.06em",
                          }}>
                            Find your dream career pathway
                          </p>
                        </div>

                        {/* LinkedIn URL pill */}
                        <div style={{
                          display: "flex", alignItems: "center",
                          width: "min(560px, 100%)", height: 60, borderRadius: 9999,
                          background: "rgba(255,255,255,0.055)",
                          border: "1px solid rgba(255,255,255,0.13)",
                          padding: "0 20px", gap: 12,
                          boxShadow: "0 0 0 4px rgba(167,139,250,0.05), 0 4px 24px rgba(0,0,0,0.3)",
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                            <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                            <path d="M7.5 10.5H5V19H7.5V10.5Z" fill="white"/>
                            <circle cx="6.25" cy="7.5" r="1.5" fill="white"/>
                            <path d="M19 19H16.5V14.5C16.5 13.4 15.8 12.8 14.9 12.8C14 12.8 13.5 13.4 13.5 14.5V19H11V10.5H13.5V11.7C13.9 11 14.8 10.3 16 10.3C17.9 10.3 19 11.5 19 13.7V19Z" fill="white"/>
                          </svg>
                          <input
                            type="url"
                            value={tlLinkedinUrl}
                            onChange={e => setTlLinkedinUrl(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && generateTimeline()}
                            placeholder="linkedin.com/in/your-name"
                            style={{
                              flex: 1, background: "none", border: "none", outline: "none",
                              fontSize: 15, color: "#ffffff", minWidth: 0,
                            }}
                          />
                        </div>

                        {/* ── Connected dream role + company pill ── */}
                        <div style={{
                          display: "flex", alignItems: "stretch",
                          width: "min(560px, 100%)", height: 60, borderRadius: 9999,
                          background: "rgba(255,255,255,0.055)",
                          border: "1px solid rgba(255,255,255,0.13)",
                          overflow: "hidden",
                          boxShadow: "0 0 0 4px rgba(52,211,153,0.04), 0 4px 24px rgba(0,0,0,0.3)",
                        }}>
                          {/* Dream role side */}
                          <div style={{
                            flex: 1, display: "flex", alignItems: "center",
                            gap: 10, padding: "0 20px", minWidth: 0,
                          }}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.75 }}>
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            <input
                              type="text"
                              value={tlDreamRole}
                              onChange={e => setTlDreamRole(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && generateTimeline()}
                              placeholder="Dream role"
                              style={{
                                flex: 1, background: "none", border: "none", outline: "none",
                                fontSize: 15, color: "#ffffff", minWidth: 0,
                              }}
                            />
                          </div>

                          {/* Divider */}
                          <div style={{ width: 1, background: "rgba(255,255,255,0.11)", flexShrink: 0, margin: "12px 0" }} />

                          {/* Dream company side */}
                          <div style={{
                            flex: 1, display: "flex", alignItems: "center",
                            gap: 10, padding: "0 20px", minWidth: 0,
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.75 }}>
                              <path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V11h6v10"/><path d="M3 7h18"/>
                            </svg>
                            <input
                              type="text"
                              value={tlDreamCompany}
                              onChange={e => setTlDreamCompany(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && generateTimeline()}
                              placeholder="Dream company"
                              style={{
                                flex: 1, background: "none", border: "none", outline: "none",
                                fontSize: 15, color: "#ffffff", minWidth: 0,
                              }}
                            />
                          </div>
                        </div>

                        {/* Error */}
                        {tlError && (
                          <p style={{ fontSize: 13, color: "rgba(251,191,36,0.75)", textAlign: "center", maxWidth: 460 }}>
                            {tlError}
                          </p>
                        )}

                        {/* Generate button */}
                        <button
                          type="button"
                          onClick={generateTimeline}
                          disabled={!tlLinkedinUrl.trim() || !tlDreamRole.trim() || !tlDreamCompany.trim() || tlLoading}
                          style={{
                            marginTop: 8, height: 54, padding: "0 44px",
                            borderRadius: 9999, fontSize: 15, fontWeight: 700,
                            letterSpacing: "0.01em",
                            display: "flex", alignItems: "center", gap: 8,
                            transition: "all 0.2s ease",
                            cursor: (tlLinkedinUrl.trim() && tlDreamRole.trim() && tlDreamCompany.trim() && !tlLoading) ? "pointer" : "default",
                            background: (tlLinkedinUrl.trim() && tlDreamRole.trim() && tlDreamCompany.trim() && !tlLoading)
                              ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${(tlLinkedinUrl.trim() && tlDreamRole.trim() && tlDreamCompany.trim() && !tlLoading) ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.10)"}`,
                            color: (tlLinkedinUrl.trim() && tlDreamRole.trim() && tlDreamCompany.trim() && !tlLoading)
                              ? "#a78bfa" : "rgba(255,255,255,0.22)",
                          }}
                        >
                          {tlLoading ? (
                            <>
                              <span className="animate-spin" style={{
                                width: 14, height: 14, borderRadius: "50%",
                                border: "2px solid rgba(167,139,250,0.30)",
                                borderTopColor: "#a78bfa",
                                flexShrink: 0, display: "inline-block",
                              }} />
                              Generating…
                            </>
                          ) : "Generate Timeline"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Phase: done — timeline canvas ────────────────────────── */}
                  {tlSteps && !tlLoading && (
                    <div className="animate-tl-in" style={{ position: "relative" }}>
                      {/* Floating "search again" button */}
                      <button
                        type="button"
                        onClick={() => { setTlSteps(null); setTlPersonName(undefined); setTlError(null); setTlDreamRole(""); setTlDreamCompany(""); }}
                        style={{
                          position: "absolute", top: 14, left: 14, zIndex: 30,
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 14px", borderRadius: 8,
                          background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 600,
                          cursor: "pointer", letterSpacing: "0.03em",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.38)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M19 12H5M11 6l-6 6 6 6"/>
                        </svg>
                        New search
                      </button>

                      {/* Full spatial canvas timeline */}
                      <CareerTimeline
                        steps={tlSteps}
                        personName={tlPersonName}
                        loading={false}
                      />
                    </div>
                  )}
                  </>
                )}

                {/* ── SETTINGS ──────────────────────────────────────────────── */}
                {activeSection === "settings" && tab !== "saved" && tab !== "attempted" && tab !== "timeline" && (
                  <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <p className="text-sm text-white/40">Settings coming soon.</p>
                  </div>
                )}

              </section>
            )}

          </div>
        </main>
        </div>
      </div>
    </div>
  );
}

export default function Prepare() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>}>
      <PrepareContent />
    </Suspense>
  );
}
