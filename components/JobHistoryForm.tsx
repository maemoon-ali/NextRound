"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { UserJobEntry, UserEducationEntry, DegreeType, RoleType } from "@/lib/livedata-types";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { US_CITIES } from "@/lib/us-cities";
import { UNIVERSITY_NAMES, getSchoolDomain } from "@/lib/us-universities";

const ROLE_TYPES: RoleType[] = ["intern", "full-time", "part-time", "contract", "freelance"];
const DEGREE_TYPES: DegreeType[] = ["Associate", "BA", "BS", "BEng", "MS", "MA", "MBA", "MFA", "MEng", "PhD", "JD", "MD", "Other"];

const ANNUAL_MAX  = 400_000;
const ANNUAL_STEP = 5_000;
const HOURLY_MAX  = 200;
const HOURLY_STEP = 1;
const CURRENT_YEAR = new Date().getFullYear();
const MAX_SCHOOLS  = 3;

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const defaultEntry: UserJobEntry = {
  company_name: "",
  years_employment: 0,
  salary: 0,
  role_type: "full-time",
  title: "",
  location: "",
};

const defaultEdu: UserEducationEntry = {
  school_name: "",
  degree_type: "",
  major: "",
  start_year: 0,
  end_year: 0,
};

interface JobHistoryFormProps {
  onSubmit: (jobs: UserJobEntry[], education: UserEducationEntry[]) => void;
  loading: boolean;
  variant?: "default" | "vibrant";
}

// ── Company logo (with text-wordmark fallback) ────────────────────────────────
function CompanyLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const domain = name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  if (!name.trim()) return null;
  return (
    <div className="flex items-center gap-2 shrink-0">
      {!failed && (
        <div style={{ width: 22, height: 22, flexShrink: 0, overflow: "hidden", borderRadius: 0 }}>
          <img src={`https://logo.clearbit.com/${domain}`} alt={name} onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      {failed && (
        <span className="text-lg font-black tracking-tight leading-none"
          style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", letterSpacing: "-0.03em", color: "rgb(52,211,153)" }}>
          {toTitleCase(name)}
        </span>
      )}
    </div>
  );
}

// ── School logo — Clearbit first, Google Favicon fallback, nothing if both fail ─
function SchoolLogo({ name, size = 26, onLoaded, onFailed }: { name: string; size?: number; onLoaded?: () => void; onFailed?: () => void }) {
  // "clearbit" → try clearbit; "favicon" → try google favicon; "none" → show nothing
  const [src, setSrc] = useState<"clearbit" | "favicon" | "none">("clearbit");
  const domain = getSchoolDomain(name);
  if (!name.trim() || !domain || src === "none") return null;

  const imgSrc = src === "clearbit"
    ? `https://logo.clearbit.com/${domain}`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div style={{ width: size, height: size, flexShrink: 0, overflow: "hidden", borderRadius: 4 }}>
      <img
        src={imgSrc}
        alt={name}
        onLoad={() => onLoaded?.()}
        onError={() => { const next = src === "clearbit" ? "favicon" : "none"; setSrc(next); if (next === "none") onFailed?.(); }}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

// ── Collapsed job card ────────────────────────────────────────────────────────
function CollapsedCard({ entry, startYear, onExpand, onRemove }: {
  entry: UserJobEntry; startYear: number | ""; onExpand: () => void; onRemove: () => void;
}) {
  const years = typeof entry.years_employment === "number" ? entry.years_employment : 0;
  const startNum = startYear === "" ? 0 : startYear;
  const endYear = Math.round(startNum + years);
  const yearRange =
    !startYear ? "" :
    years === 0 ? `${startYear}` :
    endYear >= CURRENT_YEAR ? `${startYear} – Present` :
    `${startYear} – ${endYear}`;
  const roleLabel =
    entry.role_type === "intern" ? "Internship" :
    entry.role_type ? entry.role_type.charAt(0).toUpperCase() + entry.role_type.slice(1) : "";

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/20 px-5 py-3 flex items-center justify-between gap-4 hover:border-zinc-600 hover:bg-zinc-800/40 transition-all duration-200">
      <button type="button" onClick={onExpand} className="flex items-center gap-4 min-w-0 flex-1 text-left">
        {entry.company_name?.trim()
          ? <CompanyLogo name={entry.company_name} />
          : <span className="text-sm text-zinc-600 font-normal">No Company</span>}
        <span className="text-zinc-700 shrink-0 select-none">|</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-zinc-200 font-medium truncate">
            {entry.title ? toTitleCase(entry.title) : <span className="text-zinc-600 font-normal">No title</span>}
          </span>
          {roleLabel && (
            <span className="text-xs text-zinc-500 shrink-0 flex items-center gap-1.5">
              <span className="text-base opacity-40 leading-none">·</span>
              {roleLabel}
            </span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-zinc-400 tabular-nums">{yearRange}</span>
        <button type="button" onClick={onExpand} className="text-zinc-500 hover:text-zinc-200 transition-colors duration-150" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" onClick={onRemove} className="text-zinc-500 hover:text-red-400 transition-colors duration-150" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Collapsed education card — visually distinct from job cards ───────────────
function CollapsedEducationCard({ edu, onExpand, onRemove }: {
  edu: UserEducationEntry; onExpand: () => void; onRemove: () => void;
}) {
  const startY = edu.start_year || "";
  const endY   = edu.end_year   || "";
  const yearRange = !startY && !endY ? "" : edu.end_year === 0 ? `${startY} – Present` : `${startY} – ${endY}`;
  const degreeLabel = edu.degree_type ? `${edu.degree_type}${edu.major ? " · " + edu.major : ""}` : edu.major || "";
  const [logoLoaded, setLogoLoaded] = useState(false);

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-5 py-3 flex items-center justify-between gap-4 hover:border-blue-400/50 hover:bg-blue-500/10 transition-all duration-200">
      <button type="button" onClick={onExpand} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        {/* Graduation cap — only show if no school logo loaded */}
        {!logoLoaded && (
          <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </span>
        )}

        {/* School logo — hides cap when it loads successfully */}
        {edu.school_name?.trim() && (
          <SchoolLogo name={edu.school_name} onLoaded={() => setLogoLoaded(true)} onFailed={() => setLogoLoaded(false)} />
        )}

        <div className="min-w-0">
          <p className="text-sm text-blue-100 font-medium truncate">
            {edu.school_name?.trim() || <span className="text-zinc-600 font-normal">No School</span>}
          </p>
          {degreeLabel && (
            <p className="text-[11px] text-blue-300/70 mt-0.5 truncate">{degreeLabel}</p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-blue-300/60 tabular-nums">{yearRange}</span>
        <button type="button" onClick={onExpand} className="text-blue-500/60 hover:text-blue-300 transition-colors duration-150" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" onClick={onRemove} className="text-blue-500/60 hover:text-red-400 transition-colors duration-150" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Salary slider ─────────────────────────────────────────────────────────────
function SalarySlider({ value, onChange, labelClass, isHourly, onToggleMode }: {
  value: number; onChange: (v: number) => void;
  labelClass: string; isHourly: boolean; onToggleMode: () => void;
}) {
  const max  = isHourly ? HOURLY_MAX  : ANNUAL_MAX;
  const step = isHourly ? HOURLY_STEP : ANNUAL_STEP;
  const pct  = (value / max) * 100;
  const displayValue =
    value === 0 ? "Unpaid" :
    isHourly ? (value >= HOURLY_MAX ? "$200+ / hr" : `$${value} / hr`) :
    value >= 1_000 ? `$${(value / 1_000).toFixed(0)}k / yr` : `$${value.toLocaleString()} / yr`;
  const trackStyle = {
    background: `linear-gradient(to right, rgb(52,211,153) 0%, rgb(52,211,153) ${pct}%, var(--slider-track-empty) ${pct}%, var(--slider-track-empty) 100%)`,
  };
  return (
    <div>
      <div className="flex items-center justify-between leading-none">
        <span className={labelClass} style={{ paddingTop: 3 }}>{isHourly ? "Wage" : "Salary"}</span>
        <button type="button" onClick={onToggleMode} className="flex items-center gap-1.5 select-none" title="Toggle Annual / Hourly">
          <span className="text-[10px] font-medium transition-colors duration-150"
            style={{ color: !isHourly ? "rgb(52,211,153)" : "var(--salary-muted)" }}>Annual</span>
          <span className="relative inline-flex w-8 h-4 rounded-full transition-colors duration-200 shrink-0"
            style={{ background: isHourly ? "rgba(52,211,153,0.22)" : "var(--salary-toggle-bg)" }}>
            <span className="absolute top-0.5 w-3 h-3 rounded-full transition-transform duration-200"
              style={{ background: "rgb(52,211,153)", boxShadow: "0 0 6px rgba(52,211,153,0.65)",
                transform: isHourly ? "translateX(17px)" : "translateX(2px)" }} />
          </span>
          <span className="text-[10px] font-medium transition-colors duration-150"
            style={{ color: isHourly ? "rgb(52,211,153)" : "var(--salary-muted)" }}>Hourly</span>
        </button>
      </div>
      <div className="mt-1">
        <input type="range" min={0} max={max} step={step} value={value}
          onChange={(e) => { let v = parseInt(e.target.value, 10); if (isHourly && v > 0 && v < 7) v = 7; onChange(v); }}
          className="salary-slider w-full" style={trackStyle} />
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-[10px]" style={{ color: "var(--salary-dim)" }}>Unpaid</span>
        <span className="text-xs font-semibold tabular-nums"
          style={{ color: value === 0 ? "var(--salary-zero)" : "rgb(52,211,153)" }}>{displayValue}</span>
        <span className="text-[10px]" style={{ color: "var(--salary-dim)" }}>{isHourly ? "$200+ / hr" : "$400k+"}</span>
      </div>
    </div>
  );
}

// ── Location autocomplete ─────────────────────────────────────────────────────
function LocationInput({ value, onChange, inputClass, labelClass }: {
  value: string; onChange: (v: string) => void; inputClass: string; labelClass: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);
  function handleChange(text: string) {
    onChange(text);
    if (text.trim().length >= 1) {
      const q = text.toLowerCase();
      const filtered = US_CITIES.filter((l) => l.toLowerCase().startsWith(q)).slice(0, 3);
      setSuggestions(filtered); setOpen(filtered.length > 0);
    } else { setSuggestions([]); setOpen(false); }
  }
  function select(loc: string) { onChange(loc); setOpen(false); setSuggestions([]); }
  return (
    <div ref={containerRef}>
      <span className={labelClass}>Location (Optional)</span>
      <input type="text" value={value} onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        className={inputClass} placeholder="San Francisco, CA" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <div className="location-dropdown mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "var(--pg-glass)", border: "1px solid var(--pg-glass-border)", backdropFilter: "blur(16px)" }}>
          {suggestions.map((loc) => {
            const q = value.toLowerCase(); const idx = loc.toLowerCase().indexOf(q);
            return (
              <button key={loc} type="button" onMouseDown={(e) => { e.preventDefault(); select(loc); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-500/15 transition-colors duration-100 flex items-center gap-2"
                style={{ color: "var(--pg-text)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: "var(--pg-text-muted)", flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span>
                  {idx >= 0
                    ? (<>{loc.slice(0, idx)}<span className="text-emerald-500 font-medium">{loc.slice(idx, idx + q.length)}</span>{loc.slice(idx + q.length)}</>)
                    : loc}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── School autocomplete — mirrors LocationInput pattern ───────────────────────
function SchoolInput({ value, onChange, inputClass, labelClass }: {
  value: string; onChange: (v: string) => void; inputClass: string; labelClass: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);
  function handleChange(text: string) {
    onChange(text);
    if (text.trim().length >= 1) {
      const q = text.toLowerCase();
      const filtered = UNIVERSITY_NAMES.filter(
        (u) => u.toLowerCase().startsWith(q) || u.toLowerCase().includes(q)
      ).slice(0, 5);
      setSuggestions(filtered); setOpen(filtered.length > 0);
    } else { setSuggestions([]); setOpen(false); }
  }
  function select(school: string) { onChange(school); setOpen(false); setSuggestions([]); }
  return (
    <div ref={containerRef}>
      <span className={labelClass}>College / University</span>
      <input type="text" value={value} onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        className={inputClass} placeholder="e.g. Stanford University" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <div className="location-dropdown mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "var(--pg-glass)", border: "1px solid var(--pg-glass-border)", backdropFilter: "blur(16px)" }}>
          {suggestions.map((school) => {
            const q = value.toLowerCase();
            const low = school.toLowerCase();
            const idx = low.indexOf(q);
            const domain = getSchoolDomain(school);
            return (
              <button key={school} type="button" onMouseDown={(e) => { e.preventDefault(); select(school); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-500/15 transition-colors duration-100 flex items-center gap-2.5"
                style={{ color: "var(--pg-text)" }}>
                {/* Tiny logo in dropdown — tries clearbit then google favicon */}
                {domain && (
                  <DropdownSchoolIcon domain={domain} />
                )}
                {!domain && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: "var(--pg-text-muted)", flexShrink: 0 }}>
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                )}
                <span>
                  {idx >= 0
                    ? (<>{school.slice(0, idx)}<span className="text-blue-400 font-medium">{school.slice(idx, idx + q.length)}</span>{school.slice(idx + q.length)}</>)
                    : school}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Dropdown school icon with clearbit → google favicon fallback ──────────────
function DropdownSchoolIcon({ domain }: { domain: string }) {
  const [src, setSrc] = useState<"clearbit" | "favicon" | "none">("clearbit");
  if (src === "none") return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ color: "var(--pg-text-muted)", flexShrink: 0 }}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  );
  const imgSrc = src === "clearbit"
    ? `https://logo.clearbit.com/${domain}`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  return (
    <img
      src={imgSrc}
      alt=""
      aria-hidden
      onError={() => setSrc(src === "clearbit" ? "favicon" : "none")}
      style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0, borderRadius: 3 }}
    />
  );
}

// ── Custom number step input (hides native spinners, adds sleek custom arrows) ─
function StepInput({
  value, onValueChange, min, max, step = 1, placeholder, className,
}: {
  value: number | string;
  onValueChange: (v: number | string) => void;
  min?: number; max?: number; step?: number;
  placeholder?: string; className?: string;
}) {
  function spin(dir: 1 | -1) {
    const n = value === "" ? (dir === 1 ? (min ?? 0) : 0) : parseFloat(String(value));
    if (isNaN(n)) { onValueChange(min ?? 0); return; }
    const next = Math.round((n + dir * step) * 10000) / 10000;
    if (min !== undefined && next < min) return;
    if (max !== undefined && next > max) return;
    onValueChange(next);
  }
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className, "nr-number-input pr-7")}
      />
      {/* Custom stepper arrows */}
      <div className="absolute right-0 top-0 bottom-0 w-7 flex flex-col overflow-hidden rounded-r-lg"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); spin(1); }}
          className="flex-1 flex items-center justify-center text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.07] transition-colors duration-100"
        >
          <svg width="9" height="6" viewBox="0 0 9 6" fill="currentColor">
            <path d="M4.5 0.5L8.5 5.5H0.5L4.5 0.5Z" />
          </svg>
        </button>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); spin(-1); }}
          className="flex-1 flex items-center justify-center text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.07] transition-colors duration-100"
        >
          <svg width="9" height="6" viewBox="0 0 9 6" fill="currentColor">
            <path d="M4.5 5.5L0.5 0.5H8.5L4.5 5.5Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Shared style constants ────────────────────────────────────────────────────
const inputBase    = "mt-1 w-full rounded-lg px-3 py-2 text-white focus:outline-none";
const inputDefault = "border border-zinc-600 bg-zinc-800 placeholder-zinc-500 focus:border-emerald-500";
const inputVibrant = "border-2 border-emerald-500/30 bg-zinc-800/80 placeholder-zinc-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";
const inputEdu     = "border-2 border-blue-500/30 bg-zinc-800/80 placeholder-zinc-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

function errCls(base: string, hasErr: boolean) {
  return hasErr ? base + " !border-red-500" : base;
}

// ── Main form ─────────────────────────────────────────────────────────────────
export function JobHistoryForm({ onSubmit, loading, variant = "default" }: JobHistoryFormProps) {
  const isVibrant = variant === "vibrant";
  const cardClass = isVibrant
    ? "rounded-xl border-2 border-emerald-500/25 bg-gradient-to-br from-zinc-800/50 to-emerald-950/20 p-4 space-y-4"
    : "rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 space-y-4";
  const eduCardClass = "rounded-xl border-2 border-blue-500/25 bg-blue-500/5 p-4 space-y-4";
  const labelClass   = isVibrant ? "text-xs font-semibold text-emerald-200" : "text-xs font-semibold text-zinc-300";
  const eduLabelClass = "nr-edu-label text-xs font-semibold text-blue-400";
  const inputClass   = `${inputBase} ${isVibrant ? inputVibrant : inputDefault}`;
  const eduInputClass = `nr-edu-input ${inputBase} ${inputEdu}`;

  // ── Education state ─────────────────────────────────────────────────────────
  const [showEducation, setShowEducation] = useState(false);
  const [eduEntries,   setEduEntries]   = useState<UserEducationEntry[]>([{ ...defaultEdu }]);
  const [eduCollapsed, setEduCollapsed] = useState<boolean[]>([false]);

  // ── Job history state ───────────────────────────────────────────────────────
  const [entries,     setEntries]     = useState<UserJobEntry[]>([{ ...defaultEntry }]);
  const [salaryModes, setSalaryModes] = useState<Array<"annual" | "hourly">>(["annual"]);
  const [collapsed,   setCollapsed]   = useState<boolean[]>([false]);
  const [startYears,  setStartYears]  = useState<Array<number | "">>([""]);
  const [fieldErrors, setFieldErrors] = useState<Array<Set<string>>>([new Set()]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── LinkedIn import state ───────────────────────────────────────────────────
  const [linkedinUrl,    setLinkedinUrl]    = useState("");
  const [linkedinStatus, setLinkedinStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [linkedinError,  setLinkedinError]  = useState<string | null>(null);

  // ── Education helpers ───────────────────────────────────────────────────────
  function addSchool() {
    if (eduEntries.length >= MAX_SCHOOLS) return;
    setEduCollapsed((c) => [...c.map(() => true), false]);
    setEduEntries((e) => [...e, { ...defaultEdu }]);
  }

  function removeSchool(i: number) {
    setEduEntries((e) => e.filter((_, j) => j !== i));
    setEduCollapsed((c) => c.filter((_, j) => j !== i));
  }

  function updateEdu(i: number, field: keyof UserEducationEntry, value: string | number) {
    setEduEntries((prev) => prev.map((e, j) => j !== i ? e : { ...e, [field]: value }));
  }

  function toggleEduCollapse(i: number) {
    setEduCollapsed((c) => c.map((v, j) => j === i ? !v : v));
  }

  // ── Job history helpers ─────────────────────────────────────────────────────
  function addJob() {
    setCollapsed((c) => [...c.map(() => true), false]);
    setEntries((e)     => [...e, { ...defaultEntry }]);
    setSalaryModes((m) => [...m, "annual"]);
    setStartYears((y)  => [...y, ""]);
    setFieldErrors((f) => [...f, new Set()]);
    setValidationError(null);
  }

  function removeJob(i: number) {
    if (entries.length <= 1) return;
    setEntries((e)     => e.filter((_, j) => j !== i));
    setSalaryModes((m) => m.filter((_, j) => j !== i));
    setCollapsed((c)   => c.filter((_, j) => j !== i));
    setStartYears((y)  => y.filter((_, j) => j !== i));
    setFieldErrors((f) => f.filter((_, j) => j !== i));
    setValidationError(null);
  }

  function toggleCollapse(i: number) {
    setCollapsed((c) => c.map((v, j) => j === i ? !v : v));
  }

  function update(i: number, field: keyof UserJobEntry, value: string | number) {
    setEntries((prev) => prev.map((entry, j) => j !== i ? entry : { ...entry, [field]: value }));
    setFieldErrors((prev) =>
      prev.map((s, j) => { if (j !== i) return s; const n = new Set(s); n.delete(field as string); return n; })
    );
  }

  function setRoleType(i: number, role: RoleType) {
    update(i, "role_type", role);
    setSalaryModes((m) => m.map((mode, j) => {
      if (j !== i) return mode;
      return role === "intern" ? "hourly" : mode === "hourly" && entries[i].role_type === "intern" ? "annual" : mode;
    }));
    if (role === "intern" && entries[i].role_type !== "intern") update(i, "salary", 0);
    if (role !== "intern" && entries[i].role_type === "intern") update(i, "salary", 0);
  }

  function toggleSalaryMode(i: number) {
    setSalaryModes((m) => m.map((mode, j) => j !== i ? mode : mode === "annual" ? "hourly" : "annual"));
    update(i, "salary", 0);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null); setUploadStatus("uploading");
    try {
      const formData = new FormData(); formData.set("file", file);
      const res  = await fetch("/api/parse-resume", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data?.error ?? "Failed to parse resume."); setUploadStatus("error"); return; }
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (jobs.length === 0) { setUploadError("No job history could be extracted."); setUploadStatus("error"); return; }
      setEntries(jobs.map((j: UserJobEntry) => ({ ...defaultEntry, ...j })));
      setSalaryModes(jobs.map((j: UserJobEntry) => j.role_type === "intern" ? "hourly" : "annual"));
      setCollapsed(jobs.map(() => true));
      setStartYears(jobs.map(() => ""));
      setFieldErrors(jobs.map(() => new Set<string>()));
      setUploadStatus("done"); setValidationError(null);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setUploadStatus("error");
    }
  }

  async function handleLinkedinImport() {
    if (!linkedinUrl.trim()) return;
    setLinkedinError(null); setLinkedinStatus("loading");
    try {
      const res  = await fetch("/api/import-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: linkedinUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkedinError(data?.error ?? "Failed to import profile."); setLinkedinStatus("error"); return; }
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (jobs.length === 0) { setLinkedinError("No job history could be extracted."); setLinkedinStatus("error"); return; }
      setEntries(jobs.map((j: UserJobEntry) => ({ ...defaultEntry, ...j })));
      setSalaryModes(jobs.map((j: UserJobEntry) => j.role_type === "intern" ? "hourly" : "annual"));
      // Collapse ALL imported jobs — none left open as a raw form
      setCollapsed(jobs.map(() => true));
      setStartYears(jobs.map(() => ""));
      setFieldErrors(jobs.map(() => new Set<string>()));
      // Populate education if the API returned it
      const edu = Array.isArray(data.education) ? data.education : [];
      if (edu.length > 0) {
        setEduEntries(edu.map((e: UserEducationEntry) => ({ ...defaultEdu, ...e })));
        setShowEducation(true);
      }
      setLinkedinStatus("done"); setValidationError(null); setUploadStatus("idle");
    } catch {
      setLinkedinError("Import failed. Please try again.");
      setLinkedinStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const errors: Array<Set<string>> = entries.map((entry) => {
      const errs = new Set<string>();
      if (!(entry.title ?? "").trim())        errs.add("title");
      if (!(entry.company_name ?? "").trim()) errs.add("company_name");
      if (!entry.years_employment || entry.years_employment <= 0) errs.add("years_employment");
      return errs;
    });
    const hasErrors = errors.some((s) => s.size > 0);
    if (hasErrors) {
      setFieldErrors(errors);
      setCollapsed((c) => c.map((v, i) => errors[i].size > 0 ? false : v));
      setValidationError("Please fill in all required fields for each role.");
      return;
    }
    const education = showEducation
      ? eduEntries.filter((e) => e.school_name?.trim())
      : [];
    onSubmit(
      entries.filter((x) => (x.company_name ?? "").trim().length > 0 || (x.title ?? "").trim().length > 0),
      education,
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">

      {/* ── IMPORT TOOLS (always at top) ─────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Resume upload */}
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain"
            onChange={handleResumeUpload} className="hidden" aria-hidden />
          <LiquidButton type="button" onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "uploading"} size="sm" className="text-emerald-200">
            {uploadStatus === "uploading" ? "Parsing…" : "Upload Resume"}
          </LiquidButton>
          {uploadStatus === "done" && <span className="text-sm text-emerald-400">Job history filled from resume.</span>}
          {uploadError && <p className="text-amber-400 text-sm" role="alert">{uploadError}</p>}
        </div>

        {/* LinkedIn URL */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-500">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </span>
            <input
              type="text"
              value={linkedinUrl}
              onChange={(e) => { setLinkedinUrl(e.target.value); setLinkedinStatus("idle"); setLinkedinError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLinkedinImport(); } }}
              placeholder="linkedin.com/in/yourname"
              className="w-full rounded-lg pl-8 pr-3 py-2 text-sm text-white border border-zinc-600 bg-zinc-800 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <LiquidButton type="button" onClick={handleLinkedinImport}
            disabled={linkedinStatus === "loading" || !linkedinUrl.trim()} size="sm" className="text-emerald-200 shrink-0">
            {linkedinStatus === "loading" ? "Importing…" : "Import"}
          </LiquidButton>
          {linkedinStatus === "done" && <span className="text-sm text-emerald-400">Imported from LinkedIn.</span>}
        </div>
        {linkedinError && <p className="text-amber-400 text-sm" role="alert">{linkedinError}</p>}
      </div>

      {/* ── JOB HISTORY ──────────────────────────────────────────────────────── */}
      <>
          {/* Section header */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="text-sm font-semibold text-zinc-200">Job History</span>
          </div>

          {validationError && <p className="text-amber-400 text-sm" role="alert">{validationError}</p>}

          {/* Job entries */}
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const isHourly    = salaryModes[i] === "hourly";
              const isCollapsed = collapsed[i];
              const errs        = fieldErrors[i] ?? new Set<string>();

              if (isCollapsed) {
                return (
                  <CollapsedCard key={i} entry={entry} startYear={startYears[i]}
                    onExpand={() => toggleCollapse(i)} onRemove={() => removeJob(i)} />
                );
              }

              return (
                <div key={i} className={cardClass} data-role-card="vibrant">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isVibrant ? "text-emerald-200" : "text-zinc-300"}`}>
                      Role {i + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      {entries.length > 1 && (
                        <button type="button" onClick={() => toggleCollapse(i)}
                          className="text-sm text-zinc-500 hover:text-zinc-300">Collapse</button>
                      )}
                      {entries.length > 1 && (
                        <button type="button" onClick={() => removeJob(i)}
                          className="text-sm text-red-400 hover:text-red-300">Remove</button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 items-start">
                    <label className="block">
                      <span className={labelClass}>Job Title</span>
                      <input type="text" value={entry.title ?? ""}
                        onChange={(e) => update(i, "title", e.target.value)}
                        className={errCls(inputClass, errs.has("title"))}
                        placeholder="e.g. Software Engineer" />
                      {errs.has("title") && <p className="mt-1 text-[11px] text-red-400">Required</p>}
                    </label>

                    <label className="block">
                      <span className={labelClass}>Company Name</span>
                      <input type="text" value={entry.company_name ?? ""}
                        onChange={(e) => update(i, "company_name", e.target.value)}
                        className={errCls(inputClass, errs.has("company_name"))}
                        placeholder="e.g. Stripe" />
                      {errs.has("company_name") && <p className="mt-1 text-[11px] text-red-400">Required</p>}
                    </label>

                    <div className="flex flex-col items-center">
                      <span className={labelClass}>Role Type</span>
                      <div className="mt-2 flex flex-wrap gap-2 w-full">
                        {ROLE_TYPES.map((r) => {
                          const active = (entry.role_type ?? "full-time") === r;
                          const label  = r === "intern" ? "Internship" : r.charAt(0).toUpperCase() + r.slice(1);
                          return (
                            <button key={r} type="button" onClick={() => setRoleType(i, r)}
                              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all duration-150 border whitespace-nowrap ${
                                active
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                  : "bg-white/5 text-white/55 border-white/10 hover:bg-white/10 hover:text-white/80"
                              }`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ paddingTop: 3 }}>
                      <SalarySlider value={entry.salary ?? 0} onChange={(v) => update(i, "salary", v)}
                        labelClass={labelClass} isHourly={isHourly} onToggleMode={() => toggleSalaryMode(i)} />
                    </div>

                    <label className="block">
                      <span className={labelClass}>Start Year</span>
                      <input type="number" min={1950} max={CURRENT_YEAR}
                        value={startYears[i]}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setStartYears((y) => y.map((yr, j) => j === i ? (isNaN(v) ? yr : v) : yr));
                        }}
                        className={inputClass} placeholder={String(CURRENT_YEAR)} />
                    </label>

                    <label className="block">
                      <span className={labelClass}>Years of Employment</span>
                      <input type="number" min={0} step={0.1}
                        value={entry.years_employment === 0 ? "" : (entry.years_employment ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          const parsed = parseFloat(v);
                          update(i, "years_employment", v === "" ? 0 : isNaN(parsed) ? 0 : parsed);
                        }}
                        className={errCls(inputClass, errs.has("years_employment"))}
                        placeholder="e.g. 0.5, 1.5, 4.9" />
                      {errs.has("years_employment") && <p className="mt-1 text-[11px] text-red-400">Required</p>}
                    </label>

                    <div className="sm:col-span-2">
                      <LocationInput value={entry.location ?? ""} onChange={(v) => update(i, "location", v)}
                        inputClass={inputClass} labelClass={labelClass} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Bottom actions block — single space-y-6 child so margins don't bleed ── */}
          <div className="flex flex-col gap-3">

            <div className="flex flex-wrap items-center gap-3">
              <LiquidButton type="button" onClick={addJob} size="sm" className="text-emerald-200">
                + Add another role
              </LiquidButton>
            </div>

            {/* ── EDUCATION (optional) ───────────────────────────────────────────── */}
            {!showEducation && (
              <button type="button" onClick={() => setShowEducation(true)}
                className="text-xs text-blue-400/60 hover:text-blue-300 transition-colors duration-150 w-fit">
                + Add Education <span className="text-zinc-600">(optional)</span>
              </button>
            )}

            {/* Animated education panel — slides in/out with grid-template-rows trick */}
            <div
              style={{
                display: showEducation ? "grid" : "none",
                gridTemplateRows: showEducation ? "1fr" : "0fr",
                opacity: showEducation ? 1 : 0,
                transition: "grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
              }}
            >
            <div style={{ overflow: "hidden" }}>
            {showEducation && (
              <div className="nr-edu-section space-y-3 pt-3 border-t border-zinc-700/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-blue-400 shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                  <span className="nr-edu-heading text-sm font-semibold text-blue-200">Education</span>
                  <span className="text-xs text-zinc-600">(optional)</span>
                </div>
                <button type="button" onClick={() => setShowEducation(false)}
                  className="nr-edu-util text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150 underline underline-offset-2">
                  Hide
                </button>
              </div>

              {eduEntries.map((edu, i) => {
                if (eduCollapsed[i]) {
                  return (
                    <CollapsedEducationCard key={i} edu={edu}
                      onExpand={() => toggleEduCollapse(i)}
                      onRemove={() => removeSchool(i)} />
                  );
                }
                return (
                  <div key={i} className={eduCardClass}>
                    <div className="flex items-center justify-between">
                      <span className="nr-edu-heading text-sm font-medium text-blue-200">
                        School {i + 1}
                        {i === 0 && <span className="nr-edu-subtext ml-1.5 text-xs text-blue-400/60 font-normal">(most recent)</span>}
                      </span>
                      <div className="flex items-center gap-3">
                        {eduEntries.length > 1 && (
                          <button type="button" onClick={() => toggleEduCollapse(i)}
                            className="nr-edu-util text-sm text-zinc-500 hover:text-zinc-300">Collapse</button>
                        )}
                        {eduEntries.length > 1 && (
                          <button type="button" onClick={() => removeSchool(i)}
                            className="text-sm text-red-400 hover:text-red-300">Remove</button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 items-start">
                      <div className="sm:col-span-2">
                        <SchoolInput value={edu.school_name} onChange={(v) => updateEdu(i, "school_name", v)}
                          inputClass={eduInputClass} labelClass={eduLabelClass} />
                      </div>

                      <div className="sm:col-span-2">
                        <span className={eduLabelClass}>Degree Type</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {DEGREE_TYPES.map((d) => {
                            const active = edu.degree_type === d;
                            return (
                              <button key={d} type="button" onClick={() => updateEdu(i, "degree_type", d)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
                                  active
                                    ? "nr-deg-active bg-blue-500/20 text-blue-300 border-blue-400/50"
                                    : "nr-deg-inactive bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/75"
                                }`}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="block sm:col-span-2">
                        <span className={eduLabelClass}>Major / Field of Study</span>
                        <input type="text" value={edu.major} onChange={(e) => updateEdu(i, "major", e.target.value)}
                          className={eduInputClass} placeholder="e.g. Computer Science" />
                      </label>

                      <label className="block">
                        <span className={eduLabelClass}>Start Year</span>
                        <input type="number" min={1950} max={CURRENT_YEAR}
                          value={edu.start_year || ""}
                          onChange={(e) => { const n = parseInt(e.target.value, 10); updateEdu(i, "start_year", isNaN(n) ? 0 : n); }}
                          placeholder={String(CURRENT_YEAR - 4)} className={eduInputClass} />
                      </label>
                      <label className="block">
                        <span className={eduLabelClass}>Graduation Year</span>
                        <input type="number" min={1950} max={CURRENT_YEAR + 10}
                          value={edu.end_year || ""}
                          onChange={(e) => { const n = parseInt(e.target.value, 10); updateEdu(i, "end_year", isNaN(n) ? 0 : n); }}
                          placeholder={String(CURRENT_YEAR)} className={eduInputClass} />
                        <p className="nr-edu-hint mt-1 text-[10px] text-blue-400/50">Leave blank if in progress</p>
                      </label>
                    </div>
                  </div>
                );
              })}

              {eduEntries.length < MAX_SCHOOLS && (
                <button type="button" onClick={addSchool}
                  className="nr-edu-heading text-sm text-blue-400 hover:text-blue-200 transition-colors duration-150 flex items-center gap-1">
                  <span className="text-base leading-none">+</span> Add another school
                </button>
              )}
              </div>
            )}
            </div>
            </div>

            {/* Submit — sits directly below education, moves with it */}
            <LiquidButton type="submit" disabled={loading} size="default" className="text-white font-medium w-fit">
              {loading ? "Matching…" : "Find similar roles & start practice"}
            </LiquidButton>

          </div>{/* end bottom actions block */}
        </>
    </form>
  );
}
