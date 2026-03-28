"use client";

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineStep {
  id: string;
  startYear: string;           // "2019"
  endYear?: string;            // "2022" | "Present"
  title: string;
  company: string;
  companyType: "big-tech" | "startup" | "mid-market" | "any";
  duration?: string;           // "2 yrs 3 mo"
  isCurrent?: boolean;
  isPrediction?: boolean;
  predictionBasis?: string;
}

interface CareerTimelineProps {
  steps: TimelineStep[];
  personName?: string;
  loading?: boolean;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const TYPE: Record<TimelineStep["companyType"], { color: string; glow: string; label: string }> = {
  "big-tech":   { color: "#818cf8", glow: "rgba(99,102,241,0.5)",  label: "Big Tech"   },
  "startup":    { color: "#fb923c", glow: "rgba(249,115,22,0.5)",  label: "Startup"    },
  "mid-market": { color: "#38bdf8", glow: "rgba(14,165,233,0.5)",  label: "Mid-Market" },
  "any":        { color: "#a78bfa", glow: "rgba(167,139,250,0.5)", label: "Other"      },
};

const YEAR_W  = 44;   // year label column
const SPINE_W = 24;   // spine column (dot lives here, centered at 12px from left)
const ARM_W   = 14;   // horizontal arm from dot to title

// ── Step node ─────────────────────────────────────────────────────────────────

function StepNode({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const c      = TYPE[step.companyType];
  const isPred = !!step.isPrediction;
  const dotSz  = step.isCurrent ? 13 : 9;

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>

      {/* ── Year label ── */}
      <div style={{
        width: YEAR_W, flexShrink: 0,
        paddingRight: 10, paddingTop: 4,
        textAlign: "right",
      }}>
        <span style={{
          fontSize: 11, lineHeight: "18px", fontWeight: 600,
          fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em",
          color: isPred
            ? "rgba(255,255,255,0.16)"
            : step.isCurrent
            ? "rgba(255,255,255,0.52)"
            : "rgba(255,255,255,0.24)",
        }}>
          {step.startYear}
        </span>
      </div>

      {/* ── Spine: dot + connecting line ── */}
      <div style={{ width: SPINE_W, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Dot */}
        <div style={{
          width: dotSz, height: dotSz, borderRadius: "50%",
          flexShrink: 0, marginTop: 4,
          background:  isPred ? "transparent" : c.color,
          border:      isPred ? `1.5px dashed ${c.color}` : "none",
          boxShadow:   isPred ? "none" : step.isCurrent
            ? `0 0 0 3.5px ${c.glow.replace("0.5","0.18")}, 0 0 18px ${c.glow}`
            : `0 0 0 3px   ${c.glow.replace("0.5","0.13")}`,
          position: "relative", zIndex: 1,
        }} />

        {/* Spine line below dot */}
        {!isLast && (
          <div style={{
            flex: 1, marginTop: 4, minHeight: 20,
            width:       isPred ? 0 : 1.5,
            borderLeft:  isPred ? "1.5px dashed rgba(255,255,255,0.07)" : "none",
            background:  isPred ? "none" : "linear-gradient(to bottom,rgba(255,255,255,0.10),rgba(255,255,255,0.02))",
          }} />
        )}
      </div>

      {/* ── Arm + content ── */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 22 }}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
          {/* Arm */}
          <div style={{
            width: ARM_W, height: 1, flexShrink: 0,
            background: isPred
              ? "none"
              : `linear-gradient(to right,${c.color}70,${c.color}20)`,
            borderTop: isPred ? "1px dashed rgba(255,255,255,0.11)" : "none",
          }} />

          {/* Role title */}
          <span style={{
            marginLeft: 10, fontSize: 14, fontWeight: 700, lineHeight: "20px",
            letterSpacing: "-0.01em",
            color: isPred
              ? "rgba(255,255,255,0.34)"
              : step.isCurrent
              ? "#ffffff"
              : "rgba(255,255,255,0.84)",
          }}>
            {step.title}
          </span>

          {/* "Current" badge */}
          {step.isCurrent && (
            <span style={{
              marginLeft: 8, fontSize: 9, fontWeight: 700,
              padding: "2px 7px", borderRadius: 99, flexShrink: 0,
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.42)",
              border: "1px solid rgba(255,255,255,0.12)",
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Current
            </span>
          )}

          {/* "Predicted" badge */}
          {isPred && (
            <span style={{
              marginLeft: 8, fontSize: 9, fontWeight: 700,
              padding: "2px 7px", borderRadius: 99, flexShrink: 0,
              background: "rgba(167,139,250,0.07)",
              color: "rgba(167,139,250,0.44)",
              border: "1px dashed rgba(167,139,250,0.22)",
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Predicted
            </span>
          )}
        </div>

        {/* Company + meta */}
        <div style={{ marginLeft: ARM_W + 10, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.33)", fontWeight: 500 }}>
              {step.company}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              padding: "1.5px 6px", borderRadius: 99,
              letterSpacing: "0.05em", textTransform: "uppercase",
              background: `${c.color}12`,
              color: isPred ? `${c.color}65` : c.color,
              border: `1px solid ${c.color}${isPred ? "26" : "38"}`,
            }}>
              {c.label}
            </span>
          </div>

          {(step.duration || (step.endYear && step.endYear !== step.startYear)) && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: isPred ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.22)" }}>
              {step.startYear}
              {step.endYear && step.endYear !== step.startYear ? ` – ${step.endYear}` : ""}
              {step.duration ? ` · ${step.duration}` : ""}
            </p>
          )}

          {isPred && step.predictionBasis && (
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>
              {step.predictionBasis}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Today divider ─────────────────────────────────────────────────────────────

function TodayDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "2px 0 4px" }}>
      {/* Year column spacer */}
      <div style={{ width: YEAR_W, flexShrink: 0 }} />

      {/* White dot on spine */}
      <div style={{ width: SPINE_W, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", position: "relative", zIndex: 1,
          background: "rgba(255,255,255,0.45)",
          boxShadow: "0 0 0 3px rgba(255,255,255,0.07), 0 0 10px rgba(255,255,255,0.22)",
        }} />
      </div>

      {/* "Today" label with lines */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, paddingLeft: ARM_W + 10 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span style={{
          fontSize: 10, fontWeight: 700, flexShrink: 0,
          color: "rgba(255,255,255,0.24)", letterSpacing: "0.10em", textTransform: "uppercase",
        }}>
          Today
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  const widths = [130, 160, 100, 148];
  return (
    <div>
      <style>{`
        @keyframes nr-sk { 0%,100%{opacity:.35} 50%{opacity:.85} }
      `}</style>
      {widths.map((w, i) => (
        <div key={i} style={{ display: "flex", alignItems: "stretch", marginBottom: i < widths.length - 1 ? 22 : 0 }}>
          {/* Year */}
          <div style={{ width: YEAR_W, flexShrink: 0, paddingRight: 10, paddingTop: 4 }}>
            <div style={{ width: 28, height: 11, borderRadius: 4, marginLeft: "auto",
              background: "rgba(255,255,255,0.06)", animation: `nr-sk 1.4s ease-in-out ${i*0.1}s infinite` }} />
          </div>
          {/* Spine */}
          <div style={{ width: SPINE_W, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 4, flexShrink: 0,
              background: "rgba(255,255,255,0.08)", animation: `nr-sk 1.4s ease-in-out ${i*0.12}s infinite` }} />
            {i < widths.length - 1 && (
              <div style={{ flex: 1, width: 1.5, minHeight: 20, marginTop: 4, background: "rgba(255,255,255,0.04)" }} />
            )}
          </div>
          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
              <div style={{ width: ARM_W, height: 1, background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />
              <div style={{ marginLeft: 10, height: 14, width: w, borderRadius: 4,
                background: "rgba(255,255,255,0.08)", animation: `nr-sk 1.4s ease-in-out ${i*0.14}s infinite` }} />
            </div>
            <div style={{ marginLeft: ARM_W + 10, marginTop: 6 }}>
              <div style={{ height: 11, width: 80, borderRadius: 4,
                background: "rgba(255,255,255,0.05)", animation: `nr-sk 1.4s ease-in-out ${i*0.16}s infinite` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CareerTimeline({ steps, personName, loading }: CareerTimelineProps) {
  if (loading) return <TimelineSkeleton />;
  if (!steps.length) return null;

  const realSteps = steps.filter(s => !s.isPrediction);
  const predSteps = steps.filter(s =>  s.isPrediction);
  const hasPreds  = predSteps.length > 0;

  return (
    <div>
      {personName && (
        <p style={{ marginBottom: 22, fontSize: 11, fontWeight: 600,
          color: "rgba(255,255,255,0.22)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {personName}
        </p>
      )}

      {realSteps.map((step, i) => (
        <StepNode key={step.id} step={step} isLast={!hasPreds && i === realSteps.length - 1} />
      ))}

      {hasPreds && (
        <>
          <TodayDivider />
          {predSteps.map((step, i) => (
            <StepNode key={step.id} step={step} isLast={i === predSteps.length - 1} />
          ))}
        </>
      )}
    </div>
  );
}
