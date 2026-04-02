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
import { SchoolInput } from "@/components/ui/school-input";

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

// ── Alumni Section ────────────────────────────────────────────────────────────
interface AlumnusPerson {
  id: string;
  display_name: string | null;
  current_title: string;
  current_company: string;
  current_location: string;
  current_function: string;
  current_level: string;
  job_history_summary: string;
  linkedin_url: string | null;
}
interface AlumniTrends {
  top_companies:  { name: string; count: number; pct: number }[];
  top_functions:  { name: string; count: number; pct: number }[];
  top_locations?: { name: string; count: number }[];
  total:       number;
  sample?:     number;
  senior_pct?: number;
}

function AlumniSection() {
  const [school, setSchool] = useState("");
  const [major,  setMajor]  = useState("");
  const [searchedSchool, setSearchedSchool] = useState("");
  const [searchedMajor,  setSearchedMajor]  = useState("");
  const [alumni,  setAlumni]  = useState<AlumnusPerson[]>([]);
  const [trends,  setTrends]  = useState<AlumniTrends | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [formExpanded, setFormExpanded] = useState(true);
  const [showAllAlumni, setShowAllAlumni] = useState(false);
  const [modalFilterFn, setModalFilterFn] = useState<string>("all");
  const [modalDropdownOpen, setModalDropdownOpen] = useState(false);

  async function search() {
    if (!school.trim()) return;
    setLoading(true); setError(null); setAlumni([]); setTrends(null);
    setSearchedSchool(school); setSearchedMajor(major);
    try {
      const params = new URLSearchParams({ school });
      if (major.trim()) params.set("major", major);
      const res  = await fetch(`/api/alumni?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Failed to load alumni."); return; }
      const list = data.alumni ?? [];
      if (list.length === 0) { setError("No alumni found. Try a different school name or major."); return; }
      setAlumni(list);
      setTrends(data.trends ?? null);
      setFormExpanded(false); // collapse form after successful search
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); search(); }

  const maxCompanyCount = trends?.top_companies[0]?.count ?? 1;

  const topFn = trends?.top_functions[0];

  return (
    <section className="space-y-4">

      {/* ── Search card — collapses after results load ───────────────────── */}
      <div className="relative rounded-2xl backdrop-blur-2xl border"
        style={{ background: "var(--pg-glass)", borderColor: "var(--pg-glass-border)", boxShadow: "var(--pg-glass-shadow)" }}>
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

        {/* ── COMPACT state — animates in/out with grid-template-rows trick ── */}
        <div style={{
          display: "grid",
          gridTemplateRows: (!formExpanded && searchedSchool) ? "1fr" : "0fr",
          transition: "grid-template-rows 0.4s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <div style={{ overflow: "hidden" }}>
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                opacity: (!formExpanded && searchedSchool) ? 1 : 0,
                transform: (!formExpanded && searchedSchool) ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 0.3s ease 0.1s, transform 0.3s cubic-bezier(0.16,1,0.3,1) 0.1s",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                </span>
                <span className="w-px h-4 bg-white/[0.10]" />
                <span className="text-sm font-bold text-white truncate">{searchedSchool}</span>
                {searchedMajor && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300 font-semibold shrink-0">
                    {searchedMajor}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFormExpanded(true)}
                className="ml-4 px-4 py-1.5 rounded-lg text-xs font-bold border border-white/[0.12] bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition-all shrink-0"
              >
                Search again
              </button>
            </div>
          </div>
        </div>

        {/* ── EXPANDED state — no overflow:hidden so dropdown isn't clipped ── */}
        {(formExpanded || !searchedSchool) && (
          <div className="p-6">
            {/* Title + badge */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">College Network</h2>
                <p className="text-sm text-white/45 mt-1 leading-snug">
                  See where alumni from your school work and what companies recruit them most.
                </p>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400 tracking-wider uppercase shrink-0 ml-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Data
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">School</label>
                <SchoolInput
                  value={school}
                  onChange={setSchool}
                  placeholder="e.g. MIT, Stanford, University of Michigan…"
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white border border-white/[0.14] bg-white/[0.07] placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/[0.10] transition-all"
                />
              </div>
              <div className="flex gap-2.5 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Major <span className="text-zinc-700 normal-case font-normal">— optional</span>
                  </label>
                  <input type="text" value={major} onChange={(e) => setMajor(e.target.value)}
                    placeholder="e.g. Computer Science, Finance, Economics…"
                    className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white border border-white/[0.14] bg-white/[0.07] placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/[0.10] transition-all" />
                </div>
                <button type="submit" disabled={loading || !school.trim()}
                  className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                  {loading ? "Searching…" : "Search →"}
                </button>
              </div>
              {!school && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-[11px] text-zinc-600">Quick:</span>
                  {["MIT", "Stanford", "Harvard", "UC Berkeley", "Carnegie Mellon"].map((s) => (
                    <button key={s} type="button" onClick={() => setSchool(s)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-white hover:border-white/[0.16] transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>{/* /p-6 */}
        )}{/* /expanded conditional */}
      </div>{/* /outer card */}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-300">{error}</div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {/* stat strip */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5">
                <div className="h-8 w-20 bg-white/10 rounded mb-2" />
                <div className="h-2.5 w-24 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
          {/* two col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 space-y-3">
              <div className="h-3 w-32 bg-white/10 rounded" />
              {[80,65,50,38,25].map((w,i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2 bg-white/10 rounded" style={{ width: `${w}%` }} />
                    <div className="h-1.5 bg-white/[0.06] rounded" style={{ width: `${w * 0.6}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 space-y-3">
              <div className="h-3 w-28 bg-white/10 rounded" />
              {[42,28,18,12].map((w,i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="h-2.5 bg-white/10 rounded" style={{ width: `${40+i*5}%` }} />
                    <div className="h-2.5 w-8 bg-white/[0.06] rounded" />
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
          {/* profile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-3/4 bg-white/10 rounded" />
                    <div className="h-2.5 w-1/2 bg-white/[0.06] rounded" />
                  </div>
                </div>
                <div className="h-2 w-full bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results dashboard ────────────────────────────────────────────── */}
      {!loading && trends && alumni.length > 0 && (() => {
        const fnColors = ["#60a5fa","#a78bfa","#34d399","#f59e0b","#f472b6","#fb923c","#06b6d4"];
        const personColors = ["#60a5fa","#a78bfa","#34d399","#f59e0b","#f472b6","#fb923c","#06b6d4","#e879f9","#4ade80"];

        const sample = trends.sample ?? 300;
        const top1   = trends.top_companies[0];
        const maxBar = top1?.count ?? 1; // for relative bar widths
        return (
          <>
            {/* ── Hero stat bar ───────────────────────────────────────────── */}
            <div className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
              {/* 4 equal columns with dividers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
                {[
                  { value: trends.total.toLocaleString(), label: "Alumni in Dataset",  color: "#60a5fa" },
                  { value: `${trends.senior_pct ?? "—"}%`, label: "In Senior+ Roles", color: "#34d399" },
                  { value: String(trends.top_companies.length), label: "Companies Hiring", color: "#a78bfa" },
                  topFn ? { value: `${topFn.pct}%`, label: topFn.name.split(" & ")[0], color: "#f59e0b" } : null,
                ].filter(Boolean).map((stat) => (
                  <div key={stat!.label} className="px-6 py-5">
                    <div className="text-3xl font-black text-white tracking-tight leading-none">{stat!.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mt-2 leading-tight" style={{ color: `${stat!.color}99` }}>
                      {stat!.label}
                    </div>
                  </div>
                ))}
              </div>
              {trends.sample && (
                <div className="px-6 pb-3 border-t border-white/[0.05]">
                  <p className="text-[10px] text-zinc-700 pt-2">Based on {trends.sample.toLocaleString()} sampled profiles · {trends.total.toLocaleString()} total in dataset</p>
                </div>
              )}
            </div>

            {/* ── Companies + Pathways ────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Top Hiring Companies */}
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-white/[0.07]">
                  <p className="text-sm font-bold text-white">Top Hiring Companies</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Where alumni currently work</p>
                </div>

                {/* Unified ranked list */}
                <div className="divide-y divide-white/[0.05]">
                  {trends.top_companies.map((co, i) => {
                    const isTop3 = i < 3;
                    const rankColors = ["#f59e0b", "#94a3b8", "#b45309"];
                    const rankColor = rankColors[i] ?? undefined;
                    return (
                      <div key={co.name} className={`flex items-center gap-3 px-5 ${isTop3 ? "py-3.5" : "py-2.5"} hover:bg-white/[0.03] transition-colors`}>
                        {/* Rank */}
                        <span className={`tabular-nums shrink-0 font-black ${isTop3 ? "text-sm w-5" : "text-xs w-5 text-zinc-600"}`}
                          style={rankColor ? { color: rankColor } : {}}>
                          {i + 1}
                        </span>

                        {/* Logo */}
                        <div className={`bg-white flex items-center justify-center overflow-hidden shrink-0 ${isTop3 ? "w-9 h-9" : "w-6 h-6"}`} style={{ borderRadius: 0 }}>
                          <img src={`/api/logo?company=${encodeURIComponent(co.name)}`} alt={co.name}
                            className={`object-contain ${isTop3 ? "w-7 h-7" : "w-5 h-5"}`}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              const sz = isTop3 ? 15 : 11;
                              (e.currentTarget.parentElement as HTMLElement).innerHTML =
                                `<span style="font-size:${sz}px;font-weight:900;color:#1e293b">${co.name.trim()[0]?.toUpperCase()}</span>`;
                            }} />
                        </div>

                        {/* Name + estimated count + bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`truncate font-semibold ${isTop3 ? "text-sm text-white" : "text-xs text-zinc-300"}`}>{co.name}</p>
                            <span className={`tabular-nums shrink-0 font-bold ${isTop3 ? "text-sm text-white" : "text-xs text-zinc-400"}`}>
                              {co.count.toLocaleString()}
                            </span>
                          </div>
                          {isTop3 && (
                            <div className="mt-1.5 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                style={{ width: `${Math.max((co.count / maxBar) * 100, 6)}%`, transition: "width 0.8s ease" }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Career Pathways — each row a unique color */}
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] overflow-hidden flex flex-col">
                <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
                  <p className="text-sm font-bold text-white">Career Pathways</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Function distribution across alumni</p>
                </div>
                <div className="px-5 py-4 space-y-4 flex-1">
                  {trends.top_functions.map((fn, i) => {
                    const c = fnColors[i % fnColors.length];
                    return (
                      <div key={fn.name}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                            <span className="text-sm font-semibold text-zinc-100">{fn.name}</span>
                          </div>
                          <span className="text-base font-black tabular-nums" style={{ color: c }}>{fn.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${fn.pct}%`, background: c, opacity: 0.7, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Locations inside this card */}
                {trends.top_locations && trends.top_locations.length > 0 && (
                  <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">Top Locations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {trends.top_locations.map((loc, i) => (
                        <span key={loc.name} className="text-xs px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300">
                          <span className="text-zinc-600 mr-1">{i + 1}.</span>{loc.name}
                          <span className="text-zinc-600 ml-1.5 tabular-nums">{loc.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Now Hiring ──────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-white/[0.07] flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Now Hiring</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Open roles at top alumni employers — click to apply</p>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-400 uppercase tracking-widest shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {trends.top_companies.slice(0, 6).map((co, i) => {
                  const jobsUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(co.name)}&f_TPR=r604800`;
                  const rankColors = ["#f59e0b", "#94a3b8", "#b45309"];
                  const rankColor = rankColors[i] ?? "#52525b";
                  return (
                    <a
                      key={co.name}
                      href={jobsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col rounded-xl border bg-white/[0.03] hover:bg-white/[0.07] transition-all duration-200 overflow-hidden"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    >
                      {/* Top accent bar keyed to rank */}
                      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${rankColor}90, transparent)` }} />

                      <div className="p-4 flex-1 flex flex-col gap-3">
                        {/* Logo + name row */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white flex items-center justify-center shrink-0 overflow-hidden" style={{ borderRadius: 0 }}>
                            <img
                              src={`/api/logo?company=${encodeURIComponent(co.name)}`}
                              alt={co.name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.parentElement as HTMLElement).innerHTML =
                                  `<span style="font-size:14px;font-weight:900;color:#1e293b">${co.name.trim()[0]?.toUpperCase()}</span>`;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate">{co.name}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              <span style={{ color: rankColor }} className="font-bold">{co.count.toLocaleString()}</span> alumni here
                            </p>
                          </div>
                          {/* Rank badge */}
                          <span className="text-xs font-black tabular-nums shrink-0" style={{ color: rankColor }}>#{i + 1}</span>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Apply CTA */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">LinkedIn Jobs</span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                            View open roles
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14M13 6l6 6-6 6"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* ── Alumni Profiles ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Alumni Profiles</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{searchedSchool}{searchedMajor ? ` · ${searchedMajor}` : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alumni.slice(0, 9).map((person, idx) => {
                // Color by job function, not index
                const fnColorMap: Record<string, string> = {
                  "Engineering & Infrastructure": "#60a5fa",
                  "Product & Design":             "#a78bfa",
                  "Sales & Business Dev":         "#f472b6",
                  "Marketing & Growth":           "#34d399",
                  "Operations & Strategy":        "#fb923c",
                  "Finance & Administration":     "#f59e0b",
                  "Data Science & Research":      "#06b6d4",
                  "Customer Success":             "#4ade80",
                  "Legal & Compliance":           "#e879f9",
                  "People & HR":                  "#a3e635",
                };
                const color = fnColorMap[person.current_function] ?? personColors[idx % personColors.length];
                // Use real name for initials; fall back to company initial only
                const nameParts = (person.display_name ?? "").trim().split(/\s+/).filter(Boolean);
                const initials = nameParts.length >= 2
                  ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                  : nameParts.length === 1
                    ? nameParts[0].slice(0, 2).toUpperCase()
                    : (person.current_company?.trim()[0] ?? "?").toUpperCase();
                const displayName = person.display_name?.trim() || null;
                // Shorten long function labels for chip
                const fnShort = person.current_function.split(" & ")[0];

                return (
                  <div
                    key={person.id}
                    className="rounded-lg border bg-white/[0.03] overflow-hidden transition-all duration-200 cursor-pointer group"
                    style={{ borderColor: `${color}20` }}
                    onClick={() => { if (person.linkedin_url) window.open(person.linkedin_url, "_blank", "noopener,noreferrer"); }}
                    title={person.linkedin_url ? "Open LinkedIn profile" : undefined}
                  >
                    {/* Colored top stripe */}
                    <div className="h-[3px] w-full transition-opacity duration-200 group-hover:opacity-100 opacity-70"
                      style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                    <div className="p-4">
                      {/* Avatar + name/title block */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 flex items-center justify-center shrink-0 text-sm font-black select-none bg-white"
                          style={{ color, borderRadius: 0 }}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Real name (if available) */}
                          {displayName && (
                            <p className="text-[13px] font-bold text-white leading-tight truncate">{displayName}</p>
                          )}
                          {/* Job title */}
                          <p className={`leading-snug truncate ${displayName ? "text-[11px] text-zinc-400 mt-0.5" : "text-sm font-bold text-white"}`}>
                            {person.current_title}
                          </p>
                          {/* Company in accent color */}
                          <p className="text-xs font-semibold mt-0.5 truncate" style={{ color }}>
                            {person.current_company}
                          </p>
                        </div>
                      </div>

                      {/* Tags row: function + location */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {fnShort && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                            style={{ background: `${color}12`, borderColor: `${color}28`, color: `${color}cc` }}>
                            {fnShort}
                          </span>
                        )}
                        {person.current_location && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                              <circle cx="12" cy="9" r="2.5"/>
                            </svg>
                            <span className="truncate max-w-[130px]">{person.current_location}</span>
                          </span>
                        )}
                      </div>

                      {/* LinkedIn — original style */}
                      {person.linkedin_url && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 group-hover:text-blue-400 transition-colors duration-150">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                          View profile
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View all button */}
            {alumni.length > 9 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllAlumni(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-white/[0.12] bg-white/[0.05] text-zinc-300 hover:bg-white/[0.10] hover:text-white hover:border-white/[0.20] transition-all duration-200"
                >
                  View all {alumni.length} profiles
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </button>
              </div>
            )}

            {/* ── All Profiles Modal — rendered via portal so it covers the app header ── */}
            {showAllAlumni && typeof document !== "undefined" && createPortal(
              <div
                className="fixed inset-0 flex flex-col"
                style={{ zIndex: 9999, background: "rgba(4,4,8,0.92)", backdropFilter: "blur(20px)" }}
                onClick={() => { if (modalDropdownOpen) setModalDropdownOpen(false); }}
              >
                {/* Top bar */}
                <div className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-white/[0.08]"
                  style={{ background: "rgba(8,8,12,0.98)" }}>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => { setShowAllAlumni(false); setModalFilterFn("all"); setModalDropdownOpen(false); }}
                      className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:-translate-x-0.5 transition-transform">
                        <path d="M19 12H5M12 5l-7 7 7 7"/>
                      </svg>
                      <span className="text-sm font-medium">Back</span>
                    </button>
                    <span className="w-px h-5 bg-white/[0.10]" />
                    <div>
                      <span className="text-sm font-bold text-white">{searchedSchool}</span>
                      {searchedMajor && <span className="text-sm text-zinc-500"> · {searchedMajor}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">{alumni.length} profiles</span>
                </div>

                {/* Scrollable grid */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-6xl mx-auto px-8 py-6">
                  {/* Filter bar */}
                  {(() => {
                    const fnColorMap: Record<string, string> = {
                      "Engineering & Infrastructure": "#60a5fa",
                      "Product & Design":             "#a78bfa",
                      "Sales & Business Dev":         "#f472b6",
                      "Marketing & Growth":           "#34d399",
                      "Operations & Strategy":        "#fb923c",
                      "Finance & Administration":     "#f59e0b",
                      "Data Science & Research":      "#06b6d4",
                      "Customer Success":             "#4ade80",
                      "Legal & Compliance":           "#e879f9",
                      "People & HR":                  "#a3e635",
                    };
                    const uniqueFns = Array.from(new Set(alumni.map(p => p.current_function).filter(Boolean)));
                    const filteredAlumni = modalFilterFn === "all" ? alumni : alumni.filter(p => p.current_function === modalFilterFn);
                    const activeColor = fnColorMap[modalFilterFn] ?? undefined;
                    return (
                      <>
                      <div className="flex items-center gap-3 mb-5">
                        {/* Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setModalDropdownOpen(o => !o); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all"
                            style={{
                              background: activeColor ? `${activeColor}15` : "rgba(255,255,255,0.05)",
                              borderColor: activeColor ? `${activeColor}40` : "rgba(255,255,255,0.12)",
                              color: activeColor ?? "rgba(255,255,255,0.8)",
                            }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeColor ?? "rgba(255,255,255,0.3)" }} />
                            {modalFilterFn === "all" ? "All functions" : modalFilterFn.split(" & ")[0]}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              style={{ transform: modalDropdownOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}>
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </button>

                          {modalDropdownOpen && (
                            <div
                              className="absolute top-full mt-1.5 left-0 rounded-xl border border-white/[0.12] overflow-hidden"
                              style={{ background: "rgba(12,12,18,0.98)", backdropFilter: "blur(20px)", zIndex: 10, minWidth: 220, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-1">
                                <button
                                  type="button"
                                  onClick={() => { setModalFilterFn("all"); setModalDropdownOpen(false); }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                                  style={{ background: modalFilterFn === "all" ? "rgba(255,255,255,0.08)" : "transparent", color: "rgba(255,255,255,0.8)" }}
                                >
                                  <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
                                  All functions
                                  <span className="ml-auto text-xs text-zinc-600">{alumni.length}</span>
                                </button>
                                {uniqueFns.map(fn => {
                                  const c = fnColorMap[fn] ?? "#94a3b8";
                                  const count = alumni.filter(p => p.current_function === fn).length;
                                  return (
                                    <button
                                      key={fn}
                                      type="button"
                                      onClick={() => { setModalFilterFn(fn); setModalDropdownOpen(false); }}
                                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                                      style={{ background: modalFilterFn === fn ? `${c}18` : "transparent", color: modalFilterFn === fn ? c : "rgba(255,255,255,0.7)" }}
                                    >
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                                      {fn}
                                      <span className="ml-auto text-xs text-zinc-600">{count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-600">{filteredAlumni.length} profile{filteredAlumni.length !== 1 ? "s" : ""}</span>
                      </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredAlumni.map((person, idx) => {
                      const color = fnColorMap[person.current_function] ?? personColors[idx % personColors.length];
                      const nameParts = (person.display_name ?? "").trim().split(/\s+/).filter(Boolean);
                      const initials = nameParts.length >= 2
                        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                        : nameParts.length === 1
                          ? nameParts[0].slice(0, 2).toUpperCase()
                          : (person.current_company?.trim()[0] ?? "?").toUpperCase();
                      const displayName = person.display_name?.trim() || null;
                      const fnShort = person.current_function.split(" & ")[0];

                      return (
                        <div
                          key={person.id}
                          className="rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group hover:scale-[1.01]"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderColor: `${color}25`,
                          }}
                          onClick={() => { if (person.linkedin_url) window.open(person.linkedin_url, "_blank", "noopener,noreferrer"); }}
                        >
                          {/* Color bar */}
                          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />

                          <div className="p-4">
                            {/* Avatar row */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-11 h-11 flex items-center justify-center shrink-0 text-[13px] font-black select-none bg-white"
                                style={{ color, borderRadius: 0 }}>
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                {displayName && (
                                  <p className="text-[13px] font-bold text-white leading-tight truncate">{displayName}</p>
                                )}
                                <p className={`truncate leading-snug ${displayName ? "text-[11px] text-zinc-400 mt-0.5" : "text-sm font-bold text-white"}`}>
                                  {person.current_title}
                                </p>
                                <p className="text-xs font-semibold truncate mt-0.5" style={{ color }}>
                                  {person.current_company}
                                </p>
                              </div>
                            </div>

                            {/* Function badge + location */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {fnShort && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
                                  style={{ background: `${color}15`, borderColor: `${color}30`, color }}>
                                  {fnShort}
                                </span>
                              )}
                              {person.current_location && (
                                <span className="text-[10px] text-zinc-600 truncate">{person.current_location}</span>
                              )}
                            </div>

                            {/* LinkedIn */}
                            {person.linkedin_url && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-zinc-600 group-hover:text-[#60a5fa] transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                                View profile
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>{/* /grid */}
                      </>
                    );
                  })()}
                  </div>{/* /max-w container */}
                </div>{/* /scrollable */}
              </div>,
              document.body
            )}
          </>
        );
      })()}
    </section>
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
          <div className={`py-6 space-y-6 ${activeSection === "alumni" ? "px-3" : "px-6"}`}>

            {/* Alumni section */}
            {activeSection === "alumni" && <AlumniSection />}

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
            {error && activeSection !== "behavioral" && activeSection !== "technical" && activeSection !== "alumni" && (
              <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-amber-400/[0.08] border border-amber-400/20 p-4 text-sm text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && activeSection !== "behavioral" && activeSection !== "technical" && activeSection !== "alumni" && (
              <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.10] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
                  <span className="size-4 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
                  Finding roles for your career pathway…
                </div>
              </div>
            )}

            {/* Results panel */}
            {showResultsPanel && activeSection !== "behavioral" && activeSection !== "technical" && activeSection !== "alumni" && (
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
                  <div className="rounded-xl border border-white/[0.06] p-8 text-center">
                    <p className="text-sm text-white/30">Settings coming soon.</p>
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
