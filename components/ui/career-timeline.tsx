"use client";

import React, { useRef, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineStep {
  id: string;
  startYear: string;
  endYear?: string;
  title: string;
  company: string;
  companyType: "big-tech" | "startup" | "mid-market" | "any";
  duration?: string;
  isCurrent?: boolean;
  isPrediction?: boolean;
  isTarget?: boolean;
  predictionBasis?: string;
  alternativeCompanies?: string[];
  transitionCount?: number;
}

interface CareerTimelineProps {
  steps: TimelineStep[];
  personName?: string;
  loading?: boolean;
}

interface RoleDetail {
  count: number;
  avgTenure: string | null;
  topCompanies: { name: string; count: number }[];
  commonPrevRoles: { title: string; count: number; company: string }[];
  commonNextRoles: { title: string; count: number; company: string }[];
  profiles: {
    firstName: string; lastName: string;
    currentTitle: string; currentCompany: string;
    location?: string;
    matchedRole?: string;
    prevRole: string | null; yearsExp: number;
    pathway: { title: string; company: string; startYear: string; endYear: string | null }[];
  }[];
  companyInflow?: { name: string; count: number }[];
  companyOutflow?: { name: string; count: number }[];
}

// ── Palette ───────────────────────────────────────────────────────────────────

const TYPE: Record<TimelineStep["companyType"], { color: string; glow: string; label: string }> = {
  "big-tech":   { color: "#818cf8", glow: "rgba(129,140,248,0.55)", label: "Big Tech"   },
  "startup":    { color: "#fb923c", glow: "rgba(249,115,22,0.55)",  label: "Startup"    },
  "mid-market": { color: "#38bdf8", glow: "rgba(14,165,233,0.55)",  label: "Mid-Market" },
  "any":        { color: "#a78bfa", glow: "rgba(167,139,250,0.55)", label: "Other"      },
};

const TARGET_COLOR = "#34d399";
const TARGET_GLOW  = "rgba(52,211,153,0.55)";

// ── Layout constants ──────────────────────────────────────────────────────────

const STEP_H       = 270;
const CARD_W_RIGHT = 300;
const CARD_W_LEFT  = 278;
const ARM          = 38;
const SPINE_W      = 4;
const SPINE_X      = CARD_W_LEFT + ARM;
const TOTAL_W      = SPINE_X + SPINE_W + ARM + CARD_W_RIGHT;

// ── Company logo (via /api/logo proxy — same as job matching feature) ─────────

function CompanyLogo({ name, color, size }: { name: string; color: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const skip = !name?.trim() || /^(freelance|self-employed|freelancer)/i.test(name.trim());

  const letterBox: React.CSSProperties = {
    width: size, height: size, borderRadius: 0, flexShrink: 0,
    background: `rgba(255,255,255,0.08)`,
    border: `1px solid rgba(255,255,255,0.13)`,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  };

  if (!skip && !failed) {
    const src = `/api/logo?company=${encodeURIComponent(name.trim())}`;
    return (
      <div style={{ ...letterBox, borderRadius: 0, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <img
          src={src}
          onError={() => setFailed(true)}
          style={{ width: "86%", height: "86%", objectFit: "contain" }}
          alt={name}
        />
      </div>
    );
  }
  return (
    <div style={letterBox}>
      <span style={{ fontSize: size * 0.42, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{letter}</span>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, color, bg, border, dashed }: {
  label: string; color: string; bg: string; border: string; dashed?: boolean;
}) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
      background: bg, color, border: `1px ${dashed ? "dashed" : "solid"} ${border}`,
      letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

// ── Glass card ────────────────────────────────────────────────────────────────

function GlassCard({
  step, side, zoom, onClick,
}: {
  step: TimelineStep; side: "left" | "right"; zoom: number; onClick: () => void;
}) {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark") || !document.documentElement.classList.contains("light"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Adaptive text colors for dark/light mode
  const muted1 = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.55)";
  const muted2 = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.45)";
  const muted3 = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.38)";
  const muted4 = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.48)";
  const muted5 = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.60)";
  const muted6 = isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.65)";
  const muted7 = isDark ? "rgba(255,255,255,0.58)" : "rgba(0,0,0,0.75)";
  const muted8 = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.70)";
  const muted9 = isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.65)";
  const titleColor = isDark ? "#fff" : "#111";

  const c        = TYPE[step.companyType];
  const isPred   = !!step.isPrediction;
  const isTgt    = !!step.isTarget;
  const isNoData = isPred && step.transitionCount === 0;
  const accent   = isTgt ? TARGET_COLOR : step.isCurrent ? "#fbbf24" : isPred ? "#a78bfa" : c.color;
  const glow     = isTgt ? TARGET_GLOW  : step.isCurrent ? "rgba(251,191,36,0.55)" : isPred ? "rgba(167,139,250,0.55)" : c.glow;
  const w        = side === "left" ? CARD_W_LEFT : CARD_W_RIGHT;
  const showRich = zoom >= 1.15;

  const shadow = [
    "0 8px 40px rgba(0,0,0,0.42)",
    "inset 0 1px 0 rgba(255,255,255,0.18)",
    `0 0 0 1px ${accent}18`,
    `0 0 28px ${glow.replace("0.55","0.16")}`,
  ].join(", ");

  const shadowHover = [
    "0 12px 48px rgba(0,0,0,0.50)",
    "inset 0 1px 0 rgba(255,255,255,0.22)",
    `0 0 0 1px ${accent}30`,
    `0 0 40px ${glow.replace("0.55","0.28")}`,
  ].join(", ");

  return (
    <div
      onClick={onClick}
      style={{
        width: w,
        background: isNoData
          ? (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)")
          : isTgt
          ? "rgba(52,211,153,0.09)"
          : step.isCurrent
          ? "rgba(251,191,36,0.10)"
          : isPred
          ? "rgba(139,92,246,0.10)"
          : (isDark ? c.glow.replace("0.55", "0.08") : c.glow.replace("0.55", "0.06")),
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `${step.isCurrent ? "1.5px" : "1px"} ${isPred && !isTgt ? "dashed" : "solid"} ${isNoData ? "rgba(255,255,255,0.10)" : accent + (step.isCurrent ? "60" : "45")}`,
        borderRadius: 18,
        padding: isTgt ? "20px 22px" : "14px 16px",
        boxShadow: isNoData ? "none" : shadow,
        cursor: isNoData ? "default" : "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={e => {
        if (!isNoData) {
          (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = shadowHover;
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isNoData ? "none" : shadow;
      }}
    >
      {/* Specular highlight */}
      <div style={{
        position: "absolute", inset: "0 0 auto 0", height: 1,
        background: "linear-gradient(to right, transparent, rgba(255,255,255,0.28), transparent)",
        pointerEvents: "none",
      }} />

      {/* Side accent bar */}
      {!isNoData && (
        <div style={{
          position: "absolute", top: "18%", bottom: "18%",
          [side === "right" ? "left" : "right"]: 0,
          width: 3, borderRadius: 99,
          background: `linear-gradient(to bottom, ${accent}00, ${accent}cc, ${accent}00)`,
          pointerEvents: "none",
        }} />
      )}

      {isNoData ? (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: muted1, marginBottom: 4 }}>
            No stepping-stone found
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 6 }}>
            You are ready to apply!
          </div>
          <div style={{ fontSize: 11, color: muted2, lineHeight: 1.5 }}>
            {step.company}
          </div>
          {step.predictionBasis && (
            <div style={{ fontSize: 10, color: muted3, marginTop: 6, fontStyle: "italic" }}>
              {step.predictionBasis}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <CompanyLogo name={step.company} color={accent} size={isTgt ? 44 : 38} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
                {step.isCurrent && (
                  <Badge label="Current" color={muted9} bg={isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"} border={muted4} />
                )}
                {isPred && !isTgt && (
                  <Badge label="Recommended" color="rgba(167,139,250,0.85)" bg="rgba(167,139,250,0.12)" border="rgba(167,139,250,0.35)" dashed />
                )}
                {isTgt && (
                  <Badge label="Dream Role" color="#34d399" bg="rgba(52,211,153,0.14)" border="rgba(52,211,153,0.45)" />
                )}
              </div>

              <div style={{
                fontSize: isTgt ? 18 : 14.5, fontWeight: 800,
                color: isTgt ? "#34d399" : step.isCurrent ? "#fbbf24" : isPred ? "rgba(167,139,250,0.90)" : titleColor,
                letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>
                {step.title}
              </div>

              {/* Duration only — no repeated year here */}
              {step.duration && (
                <div style={{ fontSize: 10.5, fontWeight: 500, color: isPred ? muted4 : muted5, marginTop: 2 }}>
                  {step.duration}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isPred ? muted6 : muted7 }}>
                  {step.company}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                  letterSpacing: "0.06em", textTransform: "uppercase" as const,
                  background: `${accent}18`, color: accent, border: `1px solid ${accent}40`,
                }}>
                  {c.label}
                </span>
              </div>
            </div>

            {/* Year column — right side only */}
            <div style={{
              flexShrink: 0, textAlign: "center",
              borderLeft: `1px solid ${accent}22`, paddingLeft: 12,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              alignSelf: "stretch",
            }}>
              {isPred && !isTgt && (
                <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(167,139,250,0.70)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 3 }}>
                  est.
                </div>
              )}
              <div style={{
                fontSize: 22, fontWeight: 800, lineHeight: 1,
                color: isTgt ? "#34d399" : step.isCurrent ? "#fbbf24" : isPred ? "rgba(167,139,250,0.80)" : muted8,
                letterSpacing: "-0.03em",
              }}>
                {step.startYear !== "—" ? step.startYear : "—"}
              </div>
              {isPred && !isTgt && step.startYear !== "—" && (
                <div style={{ fontSize: 9, marginTop: 3, fontWeight: 500, color: "rgba(167,139,250,0.38)" }}>
                  –{String(Number(step.startYear) + 2)}
                </div>
              )}
              {!isPred && step.endYear && step.endYear !== step.startYear && (
                <div style={{ fontSize: 10, marginTop: 3, fontWeight: 500, color: isTgt ? "rgba(52,211,153,0.70)" : muted4 }}>
                  {step.endYear === "Present" ? "Now" : step.endYear}
                </div>
              )}
            </div>
          </div>

          {/* Rich stats at high zoom */}
          {showRich && (isPred || isTgt) && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${accent}15` }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {step.transitionCount != null && step.transitionCount > 0 && (
                  <div style={{
                    display: "inline-flex", padding: "3px 9px", borderRadius: 7,
                    background: `${accent}09`, border: `1px solid ${accent}20`,
                    fontSize: 10.5, color: `${accent}bb`, fontWeight: 500,
                  }}>
                    {step.transitionCount} professionals took this step
                  </div>
                )}
              </div>
              {step.alternativeCompanies && step.alternativeCompanies.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, color: `${accent}70`, letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 5 }}>
                    Also at
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {step.alternativeCompanies.slice(0, 4).map((co, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 7, background: `${accent}10`, border: `1px solid ${accent}28`, color: `${accent}cc` }}>
                        {co}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 9, color: `${accent}60`, letterSpacing: "0.06em", textTransform: "uppercase" as const, textAlign: "right" }}>
            Click to explore →
          </div>
        </>
      )}
    </div>
  );
}

// ── Spine dot ─────────────────────────────────────────────────────────────────

function SpineDot({ step }: { step: TimelineStep }) {
  const c      = TYPE[step.companyType];
  const isTgt  = !!step.isTarget;
  const isPred = !!step.isPrediction;
  const accent = isTgt ? TARGET_COLOR : step.isCurrent ? "#fbbf24" : isPred ? "#a78bfa" : c.color;
  const glow   = isTgt ? TARGET_GLOW  : step.isCurrent ? "rgba(251,191,36,0.55)" : isPred ? "rgba(167,139,250,0.55)" : c.glow;
  const sz     = isTgt ? 22 : step.isCurrent ? 17 : 13;

  return (
    <div style={{
      width: sz, height: sz, borderRadius: "50%",
      background: isTgt
        ? "linear-gradient(135deg, #34d399, #059669)"
        : isPred ? "transparent"
        : `radial-gradient(circle at 35% 35%, ${accent}, ${accent}aa)`,
      border: isPred && !isTgt ? `2px dashed ${accent}` : "none",
      boxShadow: isTgt
        ? "0 0 0 5px rgba(52,211,153,0.20), 0 0 22px rgba(52,211,153,0.65), 0 0 44px rgba(52,211,153,0.28)"
        : step.isCurrent
        ? `0 0 0 4px ${accent}28, 0 0 18px ${glow}, 0 0 36px ${glow.replace("0.65","0.28")}`
        : isPred
        ? `0 0 0 2px ${accent}18`
        : `0 0 0 3px ${accent}22, 0 0 12px ${glow.replace("0.65","0.42")}`,
      position: "relative", zIndex: 2,
    }} />
  );
}

// ── Today divider ─────────────────────────────────────────────────────────────

function TodayDivRow({ cy }: { cy: number }) {
  return (
    <div style={{
      position: "absolute", top: cy - 1, left: -60, right: -60,
      height: 1, zIndex: 1,
      borderTop: "1px dashed rgba(255,255,255,0.10)",
    }}>
      <div style={{
        position: "absolute", left: SPINE_X + 60 - 4.5, top: -4.5,
        width: 9, height: 9, borderRadius: "50%",
        background: "rgba(255,255,255,0.60)",
        boxShadow: "0 0 0 3px rgba(255,255,255,0.08), 0 0 10px rgba(255,255,255,0.40)",
        zIndex: 3,
      }} />
      <div style={{
        position: "absolute", left: SPINE_X + 60 + 10, top: -10,
        fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
        background: "rgba(6,7,16,0.90)", padding: "2px 8px", borderRadius: 4,
        backdropFilter: "blur(8px)",
      }}>Today</div>
    </div>
  );
}

// ── Detail overlay ────────────────────────────────────────────────────────────

function DetailOverlay({
  step, side, onClose,
}: {
  step: TimelineStep; side: "left" | "right"; onClose: () => void;
}) {
  const c       = TYPE[step.companyType];
  const isTgt   = !!step.isTarget;
  const isPred  = !!step.isPrediction;
  const accent  = isTgt ? TARGET_COLOR : step.isCurrent ? "#fbbf24" : isPred ? "#a78bfa" : c.color;
  const glow    = isTgt ? TARGET_GLOW  : step.isCurrent ? "rgba(251,191,36,0.55)" : isPred ? "rgba(167,139,250,0.55)" : c.glow;

  const [visible,  setVisible]  = useState(false);
  const [detail,   setDetail]   = useState<RoleDetail | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    setFetching(true);
    fetch("/api/role-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: step.title, company: step.company }),
    })
      .then(r => r.json())
      .then(d => setDetail(d))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [step.id]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const cardIsLeft = side === "left";
  const slideCard  = cardIsLeft ? (visible ? "0%" : "-100%") : (visible ? "0%" : "100%");
  const slideData  = cardIsLeft ? (visible ? "0%" : "100%")  : (visible ? "0%" : "-100%");

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      display: "flex",
      background: "rgba(6,7,16,0.92)",
      backdropFilter: "blur(6px)",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.35s ease",
    }}>
      {/* Back button */}
      <button
        type="button" onClick={onClose}
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 60,
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 9, cursor: "pointer",
          background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5M11 6l-6 6 6 6"/>
        </svg>
        Back
      </button>

      {/* Card panel */}
      <div style={{
        width: "42%",
        order: cardIsLeft ? 0 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "60px 40px",
        background: `radial-gradient(ellipse at ${cardIsLeft ? "70%" : "30%"} 50%, ${glow.replace("0.55","0.12")} 0%, transparent 65%)`,
        borderRight: cardIsLeft ? "1px solid rgba(255,255,255,0.06)" : "none",
        borderLeft:  cardIsLeft ? "none" : "1px solid rgba(255,255,255,0.06)",
        transform: `translateX(${slideCard})`,
        transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1)",
        flexDirection: "column", gap: 28,
      }}>
        <div style={{
          width: "100%", maxWidth: 420,
          background: isTgt ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.08)",
          backdropFilter: "blur(28px)",
          border: `1px solid ${accent}55`,
          borderRadius: 24,
          padding: "28px 28px",
          boxShadow: [
            "0 20px 80px rgba(0,0,0,0.55)",
            "inset 0 1px 0 rgba(255,255,255,0.20)",
            `0 0 60px ${glow.replace("0.55","0.20")}`,
          ].join(", "),
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: "0 0 auto 0", height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.32), transparent)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <CompanyLogo name={step.company} color={accent} size={56} />
            <div>
              {isPred && !isTgt && <Badge label="Recommended" color="rgba(167,139,250,0.90)" bg="rgba(167,139,250,0.14)" border="rgba(167,139,250,0.40)" dashed />}
              {isTgt && <Badge label="Dream Role" color="#34d399" bg="rgba(52,211,153,0.14)" border="rgba(52,211,153,0.50)" />}
              {step.isCurrent && <Badge label="Current" color="rgba(255,255,255,0.55)" bg="rgba(255,255,255,0.09)" border="rgba(255,255,255,0.22)" />}
              <div style={{ fontSize: 26, fontWeight: 900, color: isTgt ? "#34d399" : "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 8 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginTop: 4 }}>
                {step.company}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: `${accent}18`, color: accent, border: `1px solid ${accent}35`, fontWeight: 600 }}>{c.label}</span>
            {step.startYear !== "—" && (
              <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)", fontWeight: 600 }}>
                {step.startYear}{step.endYear && step.endYear !== step.startYear ? ` → ${step.endYear}` : ""}
              </span>
            )}
            {step.duration && (
              <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.10)", fontWeight: 500 }}>
                {step.duration}
              </span>
            )}
          </div>

          {step.predictionBasis && (
            <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, background: `${accent}09`, border: `1px solid ${accent}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: `${accent}80`, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>From Live Data</div>
              <div style={{ fontSize: 12, color: `${accent}cc`, fontWeight: 500 }}>{step.predictionBasis}</div>
            </div>
          )}
        </div>
      </div>

      {/* Data panel */}
      <div style={{
        flex: 1,
        order: cardIsLeft ? 1 : 0,
        overflowY: "auto",
        padding: "72px 44px 44px",
        transform: `translateX(${slideData})`,
        transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.06s",
      }}>
        {fetching ? (
          <DetailSkeleton accent={accent} />
        ) : detail ? (
          <DataPanel detail={detail} accent={accent} step={step} />
        ) : (
          <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 13 }}>No data available</div>
        )}
      </div>
    </div>
  );
}

// ── Data panel ────────────────────────────────────────────────────────────────

function SectionHead({ title, subtitle, accent }: { title: string; subtitle: string; accent: string }) {
  return (
    <div style={{ marginBottom: 14, marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 3, height: 18, borderRadius: 99, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: `${accent}cc`, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{title}</span>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 400, paddingLeft: 13, lineHeight: 1.4 }}>{subtitle}</div>
    </div>
  );
}

function ProfileRow({ p, accent, defaultOpen }: {
  p: RoleDetail["profiles"][number];
  accent: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div style={{
      borderRadius: 14,
      background: open
        ? `linear-gradient(135deg, ${accent}0b 0%, rgba(255,255,255,0.03) 100%)`
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${open ? accent + "38" : "rgba(255,255,255,0.07)"}`,
      overflow: "hidden",
      transition: "border-color 0.2s, background 0.25s",
    }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "15px 18px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
          {/* Stylised avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `${accent}1a`,
            border: `1.5px solid ${accent}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 900, color: accent,
            boxShadow: `0 0 14px ${accent}20`,
          }}>
            {p.firstName[0]}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + years chip */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em" }}>
                {p.firstName} {p.lastName}
              </span>
              {p.yearsExp > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: accent,
                  padding: "2px 8px", borderRadius: 99,
                  background: `${accent}14`, border: `1px solid ${accent}30`,
                  letterSpacing: "0.02em",
                }}>
                  {p.yearsExp} yrs exp
                </span>
              )}
            </div>

            {/* Matched role (highlighted) */}
            {p.matchedRole && (
              <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginTop: 3, letterSpacing: "0.01em" }}>
                {p.matchedRole}
              </div>
            )}

            {/* Current title + company (if different from matched role) */}
            {p.currentTitle !== p.matchedRole && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1, fontWeight: 400 }}>
                {p.currentTitle}{p.currentCompany ? ` · ${p.currentCompany}` : ""}
              </div>
            )}
            {p.currentTitle === p.matchedRole && p.currentCompany && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1, fontWeight: 400 }}>
                {p.currentCompany}
              </div>
            )}

            {/* Location */}
            {p.location && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 3 }}>
                {p.location}
              </div>
            )}

            {/* Mini pathway strip */}
            {p.pathway.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 9, flexWrap: "wrap" }}>
                {p.pathway.slice(0, 3).map((job, idx) => (
                  <React.Fragment key={idx}>
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      color: idx === p.pathway.length - 1 || (idx === 2 && p.pathway.length > 3)
                        ? accent : "rgba(255,255,255,0.30)",
                      padding: "2px 7px", borderRadius: 4,
                      background: idx === p.pathway.length - 1
                        ? `${accent}12` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${idx === p.pathway.length - 1 ? accent + "25" : "rgba(255,255,255,0.06)"}`,
                      maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                    }}>
                      {job.title}
                    </span>
                    {idx < Math.min(p.pathway.length - 1, 2) && (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>→</span>
                    )}
                  </React.Fragment>
                ))}
                {p.pathway.length > 3 && (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", padding: "2px 5px",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
                    background: "rgba(255,255,255,0.03)" }}>
                    +{p.pathway.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Chevron */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "rgba(255,255,255,0.28)", transition: "transform 0.22s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0, marginTop: 4 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Expanded pathway */}
      {open && p.pathway.length > 0 && (
        <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${accent}18` }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: `${accent}70`,
            letterSpacing: "0.13em", textTransform: "uppercase" as const, marginBottom: 12, marginTop: 12 }}>
            Career Pathway · {p.pathway.length} role{p.pathway.length !== 1 ? "s" : ""}
          </div>
          <div style={{ position: "relative", paddingLeft: 22 }}>
            <div style={{
              position: "absolute", left: 7, top: 6, bottom: 6, width: 1.5,
              background: `linear-gradient(to bottom, ${accent}65, ${accent}15)`,
            }} />
            {p.pathway.map((job, idx) => {
              const isLast = idx === p.pathway.length - 1;
              return (
                <div key={idx} style={{ position: "relative", marginBottom: isLast ? 0 : 14 }}>
                  <div style={{
                    position: "absolute", left: -18, top: 5,
                    width: isLast ? 9 : 7, height: isLast ? 9 : 7, borderRadius: "50%",
                    background: isLast ? accent : `${accent}45`,
                    border: `1.5px solid ${isLast ? accent : accent + "65"}`,
                    boxShadow: isLast ? `0 0 7px ${accent}80` : "none",
                  }} />
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700,
                        color: isLast ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.55)" }}>
                        {job.title}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", marginTop: 1, fontWeight: 500 }}>
                        {job.company}
                      </div>
                    </div>
                    {job.startYear !== "—" && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.22)",
                        flexShrink: 0, paddingTop: 1 }}>
                        {job.startYear}{job.endYear ? `–${job.endYear}` : "–now"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DataPanel({ detail, accent, step }: { detail: RoleDetail; accent: string; step: TimelineStep }) {
  const maxCount = detail.topCompanies[0]?.count ?? 1;
  const c = TYPE[step.companyType];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500, marginTop: 3 }}>Live data from workforce.ai</div>
      </div>

      {/* Stat chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { val: String(detail.count),               label: "Professionals Found" },
          { val: detail.avgTenure ?? "—",             label: "Avg Time In Role"   },
          { val: String(detail.topCompanies.length),  label: "Companies Hiring"   },
        ].map(({ val, label }) => (
          <div key={label} style={{
            flex: "1 1 110px", padding: "16px 18px", borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 16px rgba(0,0,0,0.20)",
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{val}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontWeight: 700, marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</div>
          </div>
        ))}
      </div>

      {detail.topCompanies.length > 0 && (
        <>
          <SectionHead
            title="Top Hiring Companies"
            subtitle={`The companies where the most professionals currently hold the ${step.title} role, ranked by how many people we found there.`}
            accent="#38bdf8"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {detail.topCompanies.map(({ name, count }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CompanyLogo name={name} color={accent} size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", minWidth: 130 }}>{name}</span>
                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: `linear-gradient(to right, ${accent}90, ${accent}50)`, borderRadius: 99, transition: "width 0.8s ease" }} />
                </div>
                <span style={{ fontSize: 12, color: `${accent}cc`, fontWeight: 800, minWidth: 24, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(detail.companyInflow?.length ?? 0) > 0 && (
        <>
          <SectionHead
            title={`Feeder Companies → ${step.company}`}
            subtitle={`Companies people worked at immediately before joining ${step.company} as ${step.title}.`}
            accent="#f472b6"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.companyInflow!.map(({ name, count }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.18)" }}>
                <CompanyLogo name={name} color="#f472b6" size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", flex: 1 }}>{name}</span>
                <span style={{ fontSize: 12, color: "rgba(244,114,182,0.85)", fontWeight: 800, padding: "3px 10px", borderRadius: 7, background: "rgba(244,114,182,0.12)" }}>{count}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(detail.companyOutflow?.length ?? 0) > 0 && (
        <>
          <SectionHead
            title={`${step.company} → Where People Land Next`}
            subtitle={`Companies people joined after leaving the ${step.title} role at ${step.company}.`}
            accent="#fb923c"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.companyOutflow!.map(({ name, count }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.18)" }}>
                <CompanyLogo name={name} color="#fb923c" size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", flex: 1 }}>{name}</span>
                <span style={{ fontSize: 12, color: "rgba(251,146,60,0.85)", fontWeight: 800, padding: "3px 10px", borderRadius: 7, background: "rgba(251,146,60,0.12)" }}>{count}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail.commonPrevRoles.length > 0 && (
        <>
          <SectionHead
            title="Common Path To This Role"
            subtitle={`Roles that professionals held immediately before landing a ${step.title} position — your most likely stepping stones.`}
            accent="#a78bfa"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.commonPrevRoles.map(({ title, count, company }) => (
              <div key={title} style={{
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.15)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.80)", textTransform: "capitalize" as const }}>{title}</div>
                  {company && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 2, fontWeight: 500 }}>{company}</div>}
                </div>
                <span style={{ fontSize: 13, color: "rgba(167,139,250,0.85)", fontWeight: 900, padding: "3px 10px", borderRadius: 7, background: "rgba(167,139,250,0.10)", flexShrink: 0, border: "1px solid rgba(167,139,250,0.20)" }}>
                  {count}×
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail.commonNextRoles.length > 0 && (
        <>
          <SectionHead
            title="Where People Go Next"
            subtitle={`Roles that professionals move into after holding a ${step.title} position — what this role typically leads to.`}
            accent="#34d399"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.commonNextRoles.map(({ title, count, company }) => (
              <div key={title} style={{
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(52,211,153,0.15)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.80)", textTransform: "capitalize" as const }}>{title}</div>
                  {company && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 2, fontWeight: 500 }}>{company}</div>}
                </div>
                <span style={{ fontSize: 13, color: "rgba(52,211,153,0.85)", fontWeight: 900, padding: "3px 10px", borderRadius: 7, background: "rgba(52,211,153,0.10)", flexShrink: 0, border: "1px solid rgba(52,211,153,0.20)" }}>
                  {count}×
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail.profiles.length > 0 && (
        <>
          <SectionHead
            title="People In This Role"
            subtitle="Real professionals from our dataset who have held this position. Click any person to see their full career pathway."
            accent="#fb923c"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {detail.profiles.map((p, i) => (
              <ProfileRow key={i} p={p} accent="#fb923c" />
            ))}
          </div>
        </>
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

function DetailSkeleton({ accent }: { accent: string }) {
  return (
    <div>
      <style>{`@keyframes dsk{0%,100%{opacity:.18}50%{opacity:.50}}`}</style>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 72, borderRadius: 12, background: `${accent}10`, animation: `dsk 1.4s ${i * 0.12}s infinite` }} />
        ))}
      </div>
      {[200, 160, 180, 140, 190].map((w, i) => (
        <div key={i} style={{ height: 48, width: w, borderRadius: 10, background: "rgba(255,255,255,0.05)", marginBottom: 8, animation: `dsk 1.4s ${i * 0.1}s infinite` }} />
      ))}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: 40 }}>
      <style>{`@keyframes sk{0%,100%{opacity:.18}50%{opacity:.50}}`}</style>
      {[280, 250, 270, 240].map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
          <div style={{ width: w, height: 82, borderRadius: 16, background: "rgba(255,255,255,0.06)", animation: `sk 1.5s ${i * 0.15}s infinite` }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.09)", animation: `sk 1.5s ${i * 0.18}s infinite` }} />
          <div style={{ width: w - 30, height: 82, borderRadius: 16, background: "rgba(255,255,255,0.04)", animation: `sk 1.5s ${i * 0.12}s infinite` }} />
        </div>
      ))}
    </div>
  );
}

// ── Hint bubble ───────────────────────────────────────────────────────────────

function HintBubble() {
  const [v, setV] = useState(true);
  useEffect(() => { const t = setTimeout(() => setV(false), 4500); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 30, opacity: v ? 1 : 0, transition: "opacity 0.8s ease", pointerEvents: "none",
      background: "rgba(10,12,24,0.88)", backdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10,
      padding: "8px 18px", fontSize: 11, color: "rgba(255,255,255,0.40)", fontWeight: 500,
      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>Drag to pan</span>
      <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
      <span>Ctrl + scroll to zoom</span>
      <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
      <span>Click any role for live data</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CareerTimeline({ steps, personName, loading }: CareerTimelineProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.88);
  const [selected, setSelected] = useState<{ step: TimelineStep; side: "left" | "right" } | null>(null);
  const [zoomAnimate, setZoomAnimate] = useState(false);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const panRef  = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.88);
  panRef.current  = pan;
  zoomRef.current = zoom;

  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const didDrag    = useRef(false);

  const animateZoom = (fn: (z: number) => number) => {
    clearTimeout(zoomTimerRef.current);
    setZoomAnimate(true);
    setZoom(z => Math.max(0.22, Math.min(3.2, fn(z))));
    zoomTimerRef.current = setTimeout(() => setZoomAnimate(false), 420);
  };

  const resetView = () => {
    clearTimeout(zoomTimerRef.current);
    setZoomAnimate(true);
    setPan({ x: 0, y: 0 });
    setZoom(0.88);
    zoomTimerRef.current = setTimeout(() => setZoomAnimate(false), 420);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button,input,a")) return;
      isDragging.current = true;
      didDrag.current    = false;
      lastMouse.current  = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { isDragging.current = false; canvas.style.cursor = "grab"; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      clearTimeout(zoomTimerRef.current);
      setZoomAnimate(false);
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width  / 2;
      const cy = e.clientY - rect.top  - rect.height / 2;
      if (e.ctrlKey || e.metaKey) {
        const dz      = -e.deltaY * 0.008;
        const newZoom = Math.max(0.22, Math.min(3.2, zoomRef.current + dz));
        const ratio   = newZoom / zoomRef.current;
        setPan(p => ({ x: cx + (p.x - cx) * ratio, y: cy + (p.y - cy) * ratio }));
        setZoom(newZoom);
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  if (loading) return <Skeleton />;
  if (!steps.length) return null;

  const realSteps  = steps.filter(s => !s.isPrediction && !s.isTarget);
  const predSteps  = steps.filter(s =>  s.isPrediction && !s.isTarget);
  const targetStep = steps.find(s  =>  s.isTarget) ?? null;
  const hasPreds   = predSteps.length > 0 || !!targetStep;

  type Item =
    | { type: "step"; step: TimelineStep; side: "left" | "right" }
    | { type: "divider" };

  let sideIdx = 0;
  const items: Item[] = [
    ...realSteps.map(s => ({
      type: "step" as const,
      step: s,
      side: (sideIdx++ % 2 === 0 ? "right" : "left") as "left" | "right",
    })),
    ...(hasPreds ? [{ type: "divider" as const }] : []),
    ...predSteps.map(s => ({ type: "step" as const, step: s, side: "left" as "left" | "right" })),
    ...(targetStep ? [{ type: "step" as const, step: targetStep, side: "right" as "left" | "right" }] : []),
  ];

  // Scale step spacing with zoom so cards never overlap as they grow taller.
  // showRich activates at zoom≥1.15 adding ~90px of content — the spacing must grow to match.
  const stepH  = STEP_H + Math.round(Math.max(0, zoom - 0.8) * 150);

  const N      = items.length;
  const totalH = (N - 1) * stepH;
  const itemY  = (i: number) => i * stepH - totalH / 2;

  const dividerIdx  = items.findIndex(it => it.type === "divider");
  const divFrac     = dividerIdx >= 0 ? dividerIdx / Math.max(N - 1, 1) : 0.65;
  const spineTop    = itemY(0);
  const spineBottom = itemY(N - 1);

  const spineGrad = dividerIdx >= 0
    ? `linear-gradient(to bottom, rgba(129,140,248,0) 0%, rgba(129,140,248,0.92) 5%, rgba(129,140,248,0.92) ${Math.floor(divFrac * 92)}%, rgba(167,139,250,0.70) ${Math.floor(divFrac * 100)}%, rgba(52,211,153,0.85) ${Math.min(Math.floor(divFrac * 118), 93)}%, rgba(52,211,153,0) 100%)`
    : `linear-gradient(to bottom, rgba(129,140,248,0) 0%, rgba(129,140,248,0.92) 6%, rgba(129,140,248,0.92) 88%, rgba(129,140,248,0) 100%)`;

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 152px)" }}>
      <div
        ref={canvasRef}
        style={{
          width: "100%", height: "100%",
          overflow: "hidden", cursor: "grab",
          position: "absolute", inset: 0,
          borderRadius: 20, userSelect: "none",
          background: `
            radial-gradient(ellipse at 14% 22%, rgba(129,140,248,0.14) 0%, transparent 48%),
            radial-gradient(ellipse at 86% 78%, rgba(52,211,153,0.10) 0%, transparent 48%),
            radial-gradient(ellipse at 58% 42%, rgba(251,146,60,0.06) 0%, transparent 38%),
            radial-gradient(ellipse at 28% 68%, rgba(56,189,248,0.07) 0%, transparent 38%),
            rgba(6, 7, 16, 0.98)
          `,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 80px rgba(129,140,248,0.05)",
          opacity: selected ? 0.15 : 1,
          transition: "opacity 0.4s ease",
          pointerEvents: selected ? "none" : "auto",
        }}
      >
        {/* Person name — centered top */}
        {personName && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
            display: "flex", justifyContent: "center", pointerEvents: "none",
            paddingTop: 18,
          }}>
            <div style={{
              padding: "7px 20px", borderRadius: 99,
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.30)",
              fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.82)",
              letterSpacing: "0.01em",
            }}>
              {personName}
            </div>
          </div>
        )}

        {/* Zoom controls — bottom right */}
        <div style={{
          position: "absolute", bottom: 16, right: 16, zIndex: 20,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          pointerEvents: "auto",
        }}>
          <div style={{
            padding: "4px 10px", borderRadius: 99,
            background: "rgba(10,12,24,0.80)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 10, color: "rgba(255,255,255,0.38)", fontWeight: 700,
            minWidth: 44, textAlign: "center",
          }}>
            {Math.round(zoom * 100)}%
          </div>

          <div style={{
            display: "flex", flexDirection: "column",
            borderRadius: 12, overflow: "hidden",
            background: "rgba(10,12,24,0.80)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.40)",
          }}>
            {/* Zoom in */}
            <button
              type="button"
              onClick={() => animateZoom(z => z + 0.25)}
              style={{
                width: 36, height: 36, background: "none", border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                cursor: "pointer", color: "rgba(255,255,255,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
              title="Zoom in"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={resetView}
              style={{
                width: 36, height: 36, background: "none", border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                cursor: "pointer", color: "rgba(255,255,255,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
              title="Reset view"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="2"  y1="12" x2="6"  y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
              </svg>
            </button>

            {/* Zoom out */}
            <button
              type="button"
              onClick={() => animateZoom(z => z - 0.25)}
              style={{
                width: 36, height: 36, background: "none", border: "none",
                cursor: "pointer", color: "rgba(255,255,255,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
              title="Zoom out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        <HintBubble />

        {/* Transform wrapper */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: zoomAnimate ? "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}>
          <div style={{
            position: "relative",
            width: TOTAL_W, height: totalH + 180,
            marginLeft: -TOTAL_W / 2, marginTop: -(totalH + 180) / 2,
          }}>
            {/* Glowing spine */}
            <div style={{
              position: "absolute",
              left: SPINE_X,
              top: spineTop + (totalH + 180) / 2,
              height: spineBottom - spineTop,
              width: SPINE_W,
              background: spineGrad,
              boxShadow: "0 0 16px rgba(129,140,248,0.52), 0 0 32px rgba(129,140,248,0.28), 0 0 64px rgba(129,140,248,0.12)",
              borderRadius: 9999,
              zIndex: 0,
            }} />

            {items.map((item, i) => {
              const cy = itemY(i) + (totalH + 180) / 2;

              if (item.type === "divider") {
                return <TodayDivRow key="today" cy={cy} />;
              }

              const { step, side } = item;
              const isPred = !!step.isPrediction;
              const accent = step.isTarget ? TARGET_COLOR : step.isCurrent ? "#fbbf24" : step.isPrediction ? "#a78bfa" : TYPE[step.companyType].color;
              const sz     = step.isTarget ? 22 : step.isCurrent ? 17 : 13;
              const dotX   = SPINE_X + SPINE_W / 2;
              const cardX  = side === "right"
                ? SPINE_X + SPINE_W + ARM
                : SPINE_X - ARM - CARD_W_LEFT;

              return (
                <React.Fragment key={step.id}>
                  {/* Arm */}
                  <div style={{
                    position: "absolute",
                    top: cy - 1,
                    left: side === "right" ? SPINE_X + SPINE_W : SPINE_X - ARM,
                    width: ARM, height: 2, zIndex: 1,
                    background: isPred
                      ? `repeating-linear-gradient(to right, ${accent}50 0, ${accent}50 4px, transparent 4px, transparent 9px)`
                      : `linear-gradient(${side === "right" ? "to right" : "to left"}, ${accent}80, ${accent}22)`,
                  }} />

                  {/* Dot */}
                  <div style={{ position: "absolute", left: dotX - sz / 2, top: cy - sz / 2, zIndex: 2 }}>
                    <SpineDot step={step} />
                  </div>

                  {/* Card */}
                  <div style={{ position: "absolute", left: cardX, top: cy - 44, zIndex: 3 }}>
                    <GlassCard
                      step={step}
                      side={side}
                      zoom={zoom}
                      onClick={() => {
                        if (!didDrag.current && !(isPred && step.transitionCount === 0)) {
                          setSelected({ step, side });
                        }
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <DetailOverlay
          step={selected.step}
          side={selected.side}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
