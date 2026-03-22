"use client";

import { useState, useEffect, useRef } from "react";
import { CompanyLogo as SharedCompanyLogo } from "@/components/ui/company-logo";

export interface InterviewRole {
  role: string;
  company: string;
  domain: string;
  function: string;
  level: string;
}

// ── Hardcoded fallback pool ───────────────────────────────────────────────────
const ALL_ROLES: InterviewRole[] = [
  { role: "Software Engineer",         company: "Google",       domain: "google.com",       function: "engineering",  level: "mid"    },
  { role: "Software Engineer",         company: "Meta",         domain: "meta.com",         function: "engineering",  level: "mid"    },
  { role: "Software Engineer",         company: "Apple",        domain: "apple.com",        function: "engineering",  level: "mid"    },
  { role: "Software Engineer",         company: "Microsoft",    domain: "microsoft.com",    function: "engineering",  level: "mid"    },
  { role: "Software Engineer",         company: "Amazon",       domain: "amazon.com",       function: "engineering",  level: "mid"    },
  { role: "Frontend Engineer",         company: "Stripe",       domain: "stripe.com",       function: "engineering",  level: "mid"    },
  { role: "Backend Engineer",          company: "Uber",         domain: "uber.com",         function: "engineering",  level: "senior" },
  { role: "Full Stack Engineer",       company: "Airbnb",       domain: "airbnb.com",       function: "engineering",  level: "mid"    },
  { role: "iOS Engineer",              company: "Spotify",      domain: "spotify.com",      function: "engineering",  level: "mid"    },
  { role: "Android Engineer",          company: "LinkedIn",     domain: "linkedin.com",     function: "engineering",  level: "mid"    },
  { role: "Machine Learning Engineer", company: "OpenAI",       domain: "openai.com",       function: "engineering",  level: "senior" },
  { role: "ML Engineer",               company: "DeepMind",     domain: "deepmind.com",     function: "engineering",  level: "senior" },
  { role: "Site Reliability Engineer", company: "Netflix",      domain: "netflix.com",      function: "engineering",  level: "senior" },
  { role: "DevOps Engineer",           company: "Cloudflare",   domain: "cloudflare.com",   function: "engineering",  level: "mid"    },
  { role: "Product Manager",           company: "Apple",        domain: "apple.com",        function: "product",      level: "mid"    },
  { role: "Product Manager",           company: "Google",       domain: "google.com",       function: "product",      level: "senior" },
  { role: "Product Manager",           company: "Airbnb",       domain: "airbnb.com",       function: "product",      level: "senior" },
  { role: "Product Manager",           company: "Figma",        domain: "figma.com",        function: "product",      level: "mid"    },
  { role: "Technical Program Manager", company: "Microsoft",    domain: "microsoft.com",    function: "product",      level: "senior" },
  { role: "Data Scientist",            company: "Netflix",      domain: "netflix.com",      function: "data_science", level: "mid"    },
  { role: "Data Scientist",            company: "Spotify",      domain: "spotify.com",      function: "data_science", level: "mid"    },
  { role: "Data Engineer",             company: "Databricks",   domain: "databricks.com",   function: "data_science", level: "mid"    },
  { role: "Analytics Engineer",        company: "Shopify",      domain: "shopify.com",      function: "data_science", level: "mid"    },
  { role: "Product Designer",          company: "Figma",        domain: "figma.com",        function: "design",       level: "mid"    },
  { role: "UX Designer",               company: "Adobe",        domain: "adobe.com",        function: "design",       level: "mid"    },
  { role: "UX Researcher",             company: "Google",       domain: "google.com",       function: "design",       level: "mid"    },
  { role: "Financial Analyst",         company: "Goldman Sachs",domain: "goldmansachs.com", function: "finance",      level: "entry"  },
  { role: "Strategy Analyst",          company: "McKinsey",     domain: "mckinsey.com",     function: "strategy",     level: "entry"  },
  { role: "Operations Manager",        company: "Amazon",       domain: "amazon.com",       function: "operations",   level: "mid"    },
  { role: "Marketing Manager",         company: "HubSpot",      domain: "hubspot.com",      function: "marketing",    level: "mid"    },
];

const TRENDING_BEHAVIORAL: InterviewRole[] = [
  ALL_ROLES.find(r => r.role === "Product Manager"    && r.company === "Google")!,
  ALL_ROLES.find(r => r.role === "Strategy Analyst"   && r.company === "McKinsey")!,
  ALL_ROLES.find(r => r.role === "Operations Manager" && r.company === "Amazon")!,
  ALL_ROLES.find(r => r.role === "Marketing Manager"  && r.company === "HubSpot")!,
];

const TRENDING_TECHNICAL: InterviewRole[] = [
  ALL_ROLES.find(r => r.role === "Software Engineer"        && r.company === "Google")!,
  ALL_ROLES.find(r => r.role === "Machine Learning Engineer" && r.company === "OpenAI")!,
  ALL_ROLES.find(r => r.role === "Backend Engineer"         && r.company === "Uber")!,
  ALL_ROLES.find(r => r.role === "Data Engineer"            && r.company === "Databricks")!,
];

// ── Per-type visual theme ─────────────────────────────────────────────────────
interface Theme {
  gradient:      string;
  accentRgb:     string;
  accentHex:     string;
  hoverBorder:   string;
  badgeBg:       string;
  badgeBorder:   string;
  badgeText:     string;
  spinnerAccent: string;
  liveLabel:     string;
  trendingLabel: string;
  tags:          string[];
  tagBg:         string;
  tagBorder:     string;
  tagText:       string;
  headerGlow:    string;
  searchBarGlow: string;
}

const THEMES: Record<"behavioral" | "technical", Theme> = {
  behavioral: {
    gradient:       "linear-gradient(135deg,#020d1a 0%,#071428 40%,#031a10 70%,#060e20 100%)",
    accentRgb:      "52,211,153",
    accentHex:      "#34d399",
    hoverBorder:    "rgba(52,211,153,0.38)",
    badgeBg:        "rgba(52,211,153,0.12)",
    badgeBorder:    "rgba(52,211,153,0.22)",
    badgeText:      "#34d399",
    spinnerAccent:  "border-t-emerald-400",
    liveLabel:      "text-emerald-400/70",
    trendingLabel:  "text-emerald-500/60",
    tags:           ["STAR Method", "Communication", "Leadership", "Culture Fit"],
    tagBg:          "rgba(52,211,153,0.08)",
    tagBorder:      "rgba(52,211,153,0.18)",
    tagText:        "rgba(52,211,153,0.9)",
    headerGlow:     "rgba(52,211,153,0.18)",
    searchBarGlow:  "0 0 0 1.5px rgba(52,211,153,0.18), 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  technical: {
    gradient:       "linear-gradient(135deg,#020818 0%,#07082e 40%,#04101e 70%,#080620 100%)",
    accentRgb:      "99,179,237",
    accentHex:      "#63b3ed",
    hoverBorder:    "rgba(99,179,237,0.38)",
    badgeBg:        "rgba(99,179,237,0.12)",
    badgeBorder:    "rgba(99,179,237,0.22)",
    badgeText:      "#63b3ed",
    spinnerAccent:  "border-t-blue-400",
    liveLabel:      "text-blue-400/70",
    trendingLabel:  "text-blue-500/60",
    tags:           ["Algorithms", "System Design", "Data Structures", "Coding"],
    tagBg:          "rgba(99,179,237,0.08)",
    tagBorder:      "rgba(99,179,237,0.18)",
    tagText:        "rgba(147,197,253,0.9)",
    headerGlow:     "rgba(99,179,237,0.15)",
    searchBarGlow:  "0 0 0 1.5px rgba(99,179,237,0.18), 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14)",
  },
};

// ── Icons ─────────────────────────────────────────────────────────────────────
function BehavioralIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <line x1="9" y1="10" x2="15" y2="10"/>
      <line x1="9" y1="13" x2="13" y2="13"/>
    </svg>
  );
}

function TechnicalIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
      <line x1="12" y1="4" x2="12" y2="20" strokeOpacity="0.5"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  return q.split(/\s+/).every((word) => t.includes(word));
}

function localSearch(q: string): InterviewRole[] {
  return ALL_ROLES.filter(
    (r) => fuzzyMatch(q, r.role) || fuzzyMatch(q, r.company) || fuzzyMatch(q, `${r.role} ${r.company}`)
  ).slice(0, 8);
}

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  return <SharedCompanyLogo name={name} domain={domain} size="h-10 w-10" />;
}

// ── RoleCard (accent-aware) ───────────────────────────────────────────────────
interface RoleCardProps {
  r: InterviewRole;
  onSelect: (r: InterviewRole) => void;
  theme: Theme;
}

function RoleCard({ r, onSelect, theme }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(r)}
      className="group w-full text-left relative rounded-xl overflow-hidden border transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = `rgba(${theme.accentRgb},0.06)`;
        (e.currentTarget as HTMLElement).style.borderColor = theme.hoverBorder;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-center gap-3 p-4">
        <CompanyLogo domain={r.domain} name={r.company} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm truncate">{r.role}</p>
          <p className="text-xs text-zinc-400 truncate">{r.company}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
            style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, color: theme.badgeText }}
          >
            {r.function.replace(/_/g, " ")}
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={`rgba(${theme.accentRgb},0.7)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "stroke 0.15s" }}
            className="group-hover:opacity-100"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface InterviewSearchProps {
  type: "behavioral" | "technical";
  onSelect: (r: InterviewRole) => void;
  embedded?: boolean;
}

export function InterviewSearch({ type, onSelect, embedded = false }: InterviewSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InterviewRole[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const hasQuery = query.trim().length > 0;
  const theme    = THEMES[type];
  const trending = type === "behavioral" ? TRENDING_BEHAVIORAL : TRENDING_TECHNICAL;

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!q) { setResults([]); setApiLoading(false); return; }

    setResults(localSearch(q));

    debounceRef.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      setApiLoading(true);
      try {
        const res  = await fetch(`/api/interview-roles?q=${encodeURIComponent(q)}&type=${type}`, { signal: ac.signal });
        if (!res.ok) throw new Error("API error");
        const data = (await res.json()) as { roles: InterviewRole[] };
        if (!ac.signal.aborted) setResults(data.roles.length > 0 ? data.roles : localSearch(q));
      } catch { /* aborted or failed — keep local */ } finally {
        if (!ac.signal.aborted) setApiLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, type]);

  const isBehavioral = type === "behavioral";
  const title    = isBehavioral ? "Mock Behavioral Interview"  : "Mock Technical Interview";
  const subtitle = isBehavioral
    ? "Practice telling your story with STAR-format behavioral questions."
    : "Solve a real coding problem with voice-narrated reasoning.";

  return (
    <div
      className={embedded
        ? "flex flex-col items-center justify-start w-full px-2 pt-4 pb-10"
        : "flex flex-col items-center justify-start min-h-screen px-4 pt-16 pb-10"
      }
      style={embedded ? undefined : { background: theme.gradient }}
    >
      {/* ── Header ── */}
      <div className="w-full max-w-2xl mb-8 text-center">
        {/* Icon bubble */}
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, boxShadow: `0 0 32px ${theme.headerGlow}` }}
        >
          {isBehavioral
            ? <BehavioralIcon color={theme.accentHex} />
            : <TechnicalIcon  color={theme.accentHex} />
          }
        </div>

        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">{title}</h1>
        <p className="text-zinc-400 text-sm mb-5">{subtitle}</p>

        {/* Skill tags */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {theme.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
              style={{ background: theme.tagBg, border: `1px solid ${theme.tagBorder}`, color: theme.tagText }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="w-full max-w-2xl relative mb-8">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: `1.5px solid rgba(${theme.accentRgb},0.22)`,
            boxShadow: theme.searchBarGlow,
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, rgba(${theme.accentRgb},0.4), transparent)` }}
          />
          <div className="flex items-center gap-3 px-5 py-4">
            {apiLoading ? (
              <span className={`shrink-0 size-4 rounded-full border-2 border-zinc-700 ${theme.spinnerAccent} animate-spin`} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={`rgba(${theme.accentRgb},0.5)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any role or company from workforce.ai…"
              autoFocus
              className="flex-1 bg-transparent text-white placeholder-zinc-600 text-base outline-none"
            />
            {hasQuery && (
              <button type="button" onClick={() => setQuery("")}
                className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results / Trending ── */}
      <div className="w-full max-w-2xl space-y-3">
        {hasQuery ? (
          <>
            <div className="flex items-center gap-2 mb-1 px-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {results.length > 0
                  ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                  : apiLoading ? "Searching…" : "No results"}
              </p>
              {apiLoading && <span className={`text-[10px] font-medium ${theme.liveLabel}`}>· live from workforce.ai</span>}
              {!apiLoading && results.length > 0 && <span className="text-[10px] font-medium text-zinc-600">· from workforce.ai</span>}
            </div>
            {results.length > 0
              ? results.map((r, i) => <RoleCard key={`${r.company}|${r.role}|${i}`} r={r} onSelect={onSelect} theme={theme} />)
              : !apiLoading && (
                <div
                  className="rounded-xl p-6 text-center text-sm"
                  style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, color: "rgba(255,255,255,0.35)" }}
                >
                  No matching roles found. Try a different title or company name.
                </div>
              )
            }
          </>
        ) : (
          <>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 px-1 ${theme.trendingLabel}`}>
              {isBehavioral ? "Popular for Behavioral" : "Popular for Technical"}
            </p>
            {trending.map((r, i) => (
              <RoleCard key={`trending-${i}`} r={r} onSelect={onSelect} theme={theme} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
