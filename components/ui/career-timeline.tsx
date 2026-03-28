"use client";

import React, { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineStep {
  id: string;
  year: string;             // e.g. "Year 1–2"
  title: string;            // role title
  company: string;          // company or company type
  companyType: "big-tech" | "startup" | "mid-market" | "any";
  duration: string;         // e.g. "18–24 months"
  why: string;              // one-sentence rationale
  isTarget?: boolean;       // marks the dream job node
  isCurrent?: boolean;      // marks the user's current position
  alternatives?: {          // zoom-in branching paths
    title: string;
    company: string;
    why: string;
  }[];
  probability?: number;     // % of people who took this path
}

interface CareerTimelineProps {
  dreamRole: string;
  dreamCompany: string;
  currentRole?: string;
  steps: TimelineStep[];
  loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPANY_TYPE_COLOR: Record<TimelineStep["companyType"], { ring: string; dot: string; tag: string; tagText: string }> = {
  "big-tech":   { ring: "rgba(99,102,241,0.35)",  dot: "#818cf8", tag: "bg-indigo-500/10 border-indigo-500/25 text-indigo-300",  tagText: "Big Tech"    },
  "startup":    { ring: "rgba(249,115,22,0.30)",  dot: "#fb923c", tag: "bg-orange-500/10 border-orange-500/25 text-orange-300",  tagText: "Startup"     },
  "mid-market": { ring: "rgba(14,165,233,0.30)",  dot: "#38bdf8", tag: "bg-sky-500/10    border-sky-500/25    text-sky-300",     tagText: "Mid-Market"  },
  "any":        { ring: "rgba(52,211,153,0.30)",  dot: "#34d399", tag: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300", tagText: "Any"        },
};

// ── Step node ─────────────────────────────────────────────────────────────────

function StepNode({ step, index, expanded, onToggle }: {
  step: TimelineStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = COMPANY_TYPE_COLOR[step.companyType];
  const isSpecial = step.isTarget || step.isCurrent;

  return (
    <div className="relative flex gap-5 group">
      {/* Dot + connector */}
      <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
        {/* Dot */}
        <div
          style={{
            width: step.isTarget ? 22 : step.isCurrent ? 18 : 14,
            height: step.isTarget ? 22 : step.isCurrent ? 18 : 14,
            borderRadius: "50%",
            background: step.isTarget
              ? "linear-gradient(135deg, #34d399, #059669)"
              : step.isCurrent
              ? "rgba(255,255,255,0.15)"
              : colors.dot,
            boxShadow: step.isTarget
              ? "0 0 0 5px rgba(52,211,153,0.15), 0 0 20px rgba(52,211,153,0.35)"
              : step.isCurrent
              ? "0 0 0 3px rgba(255,255,255,0.08)"
              : `0 0 0 3px ${colors.ring}`,
            border: step.isCurrent ? "2px solid rgba(255,255,255,0.25)" : "none",
            flexShrink: 0,
            transition: "box-shadow 0.2s ease",
          }}
        />
        {/* Line below */}
        {!step.isTarget && (
          <div style={{
            width: 1.5,
            flex: 1,
            minHeight: 40,
            background: "linear-gradient(to bottom, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
            marginTop: 6,
          }} />
        )}
      </div>

      {/* Card */}
      <div style={{ flex: 1, paddingBottom: step.isTarget ? 0 : 20 }}>
        {/* Year label */}
        {!step.isCurrent && (
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
            {step.year}
          </p>
        )}

        <div
          style={{
            background: step.isTarget
              ? "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(5,150,105,0.06))"
              : step.isCurrent
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.03)",
            border: step.isTarget
              ? "1px solid rgba(52,211,153,0.25)"
              : step.isCurrent
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "14px 16px",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 700,
                  color: step.isTarget ? "#34d399" : step.isCurrent ? "rgba(255,255,255,0.55)" : "#fff",
                  letterSpacing: "-0.01em",
                }}>
                  {step.title}
                </p>
                {step.isTarget && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    background: "rgba(52,211,153,0.15)", color: "#34d399",
                    border: "1px solid rgba(52,211,153,0.3)", letterSpacing: "0.05em", textTransform: "uppercase",
                  }}>
                    Dream Role
                  </span>
                )}
                {step.isCurrent && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                    background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.12)", letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>
                    You are here
                  </span>
                )}
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>
                {step.company}
              </p>
            </div>

            {/* Right: tags */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              {!step.isCurrent && !step.isTarget && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}
                  className={`border ${colors.tag}`}>
                  {colors.tagText}
                </span>
              )}
              {step.duration && !step.isCurrent && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>
                  {step.duration}
                </span>
              )}
              {step.probability != null && !step.isCurrent && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>
                  {step.probability}% take this path
                </span>
              )}
            </div>
          </div>

          {/* Why */}
          {step.why && !step.isCurrent && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.6 }}>
              {step.why}
            </p>
          )}

          {/* Alternatives toggle */}
          {step.alternatives && step.alternatives.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              style={{
                display: "flex", alignItems: "center", gap: 6, marginTop: 12,
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.03em",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
              {expanded ? "Hide" : "See"} {step.alternatives.length} alternative{step.alternatives.length > 1 ? "s" : ""}
            </button>
          )}

          {/* Expanded alternatives */}
          {expanded && step.alternatives && (
            <div style={{
              marginTop: 12,
              display: "grid",
              gridTemplateRows: "1fr",
              opacity: 1,
              animation: "tl-expand 0.22s ease both",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {step.alternatives.map((alt, ai) => (
                  <div key={ai} style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.70)" }}>{alt.title}</p>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>@ {alt.company}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.33)", lineHeight: 1.55 }}>{alt.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {[120, 90, 110, 80, 100].map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 20, paddingBottom: i < 4 ? 20 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 }}>
            <div style={{
              width: i === 4 ? 22 : 14, height: i === 4 ? 22 : 14, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)", animation: "nr-skeleton-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }} />
            {i < 4 && <div style={{ width: 1.5, flex: 1, minHeight: 48, background: "rgba(255,255,255,0.06)", marginTop: 6 }} />}
          </div>
          <div style={{ flex: 1, paddingTop: 2 }}>
            <div style={{ height: 10, width: 60, borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 10,
              animation: "nr-skeleton-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px",
              background: "rgba(255,255,255,0.025)" }}>
              <div style={{ height: 14, width: `${w}px`, borderRadius: 6, background: "rgba(255,255,255,0.07)", marginBottom: 8,
                animation: "nr-skeleton-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
              <div style={{ height: 10, width: 80, borderRadius: 6, background: "rgba(255,255,255,0.05)",
                animation: "nr-skeleton-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes nr-skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes tl-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CareerTimeline({ dreamRole, dreamCompany, currentRole, steps, loading }: CareerTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (loading) return <TimelineSkeleton />;

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes tl-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {steps.map((step, i) => (
        <StepNode
          key={step.id}
          step={step}
          index={i}
          expanded={!!expanded[step.id]}
          onToggle={() => toggle(step.id)}
        />
      ))}
    </div>
  );
}
