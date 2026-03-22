"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";

type PersonAtCompany = {
  id: string;
  display_name: string;
  job_history_summary: string;
  linkedin_url: string;
};
import { CompanyLogo as CompanyLogoShared } from "@/components/ui/company-logo";
import { LocationMapCard } from "@/components/ui/location-map";
import { GlowEffect } from "@/components/ui/glow-effect";
import { ProfileRevealCard } from "@/components/ui/animated-profile-card";
import { NexaIsland } from "@/components/ui/nexa-island";

type CompanyMeta = {
  company: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  countries: string[];
  profiles_in_dataset: number;
  roles_at_company: number;
  roles_matching_filters: number;
  top_titles: { title: string; count: number }[];
  top_titles_matching_filters: { title: string; count: number }[];
  careers_url: string | null;
  difficulty: { level: string; note: string };
};

/** Return a longer explanation for a short match reason. */
function expandMatchReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("similar or related company")) return "Your job history includes companies in a similar industry, size, or profile to this employer. That means the culture, pace, and expectations here are likely to align with what you’ve already experienced, so you can speak to relevant examples in interviews.";
  if (r.includes("aligned seniority") || r.includes("typical next level")) return "The seniority level of this role (e.g. entry, senior, manager) matches where you are in your career based on your titles and tenure. That makes this a realistic next step rather than a stretch or a step back, which improves fit and hiring likelihood.";
  if (r.includes("similar experience length") || r.includes("tenure")) return "The time you’ve spent in your recent roles is in a similar range to what we see for people in this type of position. That suggests your experience depth is right for the level of ownership and scope this role expects.";
  if (r.includes("location matches") || r.includes("preferred area")) return "You’ve worked in or indicated interest in this city or region. Employers often prefer local candidates or those already planning to be in the area, so your location alignment is a concrete advantage for this role.";
  if (r.includes("title aligns") || r.includes("background")) return "Your past job titles share skills and responsibilities with this role. Recruiters and hiring managers look for this overlap when screening; your title history signals that you can do the job and speak the same language as the team.";
  if (r.includes("career pathway") || r.includes("workforce patterns")) return "LiveDataTechnologies workforce data shows that professionals with job histories like yours often move into roles like this one. The match reflects real career-path patterns, not just keyword overlap, so this role is a plausible and data-backed next step for you.";
  return "This factor contributes to why your profile was ranked highly for this role. Together with the other reasons, it indicates a strong fit between your experience and what this position requires.";
}

function CompanyLogo({ name, domain }: { name: string; domain?: string }) {
  return <CompanyLogoShared name={name} domain={domain} size="h-14 w-14" />;
}

// ── Nexa launch button ────────────────────────────────────────────────────────
function NexaButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full overflow-hidden rounded-xl bg-black border border-white/15 hover:border-white/30 transition-colors duration-200"
    >
      {/* Label row */}
      <div className="px-5 py-3.5 flex items-center justify-center">
        <span
          className="text-sm font-light tracking-widest"
          style={{ fontFamily: "var(--font-sora), sans-serif", color: "#ffffff" }}
        >
          Ask nexa
        </span>
      </div>

      {/* Expandable logo panel — slides down on hover */}
      <div
        style={{
          maxHeight: hovered ? "160px" : "0px",
          opacity: hovered ? 1 : 0,
          transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
          overflow: "hidden",
        }}
      >
        <div className="px-3 pb-3 pt-0">
          <img
            src="/nexa-logo.png"
            alt="Nexa"
            draggable={false}
            className="w-full object-cover"
            style={{ display: "block", borderRadius: 8, userSelect: "none" }}
          />
        </div>
      </div>
    </button>
  );
}

function RoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const company = searchParams.get("company") ?? "";
  const role = searchParams.get("role") ?? "Role";
  const location = searchParams.get("location") ?? "";
  const function_ = searchParams.get("function") ?? "";
  const level = searchParams.get("level") ?? "";
  const reasonsJson = searchParams.get("reasons");
  const matchReasons: string[] = reasonsJson
    ? (() => {
        try {
          return JSON.parse(decodeURIComponent(reasonsJson));
        } catch {
          return [];
        }
      })()
    : [];
  const domain = searchParams.get("domain") ?? undefined;
  const school = searchParams.get("school") ?? "";
  const scoreParam = searchParams.get("score");
  const matchScore: number | null =
    scoreParam != null && scoreParam !== ""
      ? (() => {
          const n = parseFloat(scoreParam);
          return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
        })()
      : null;

  const [peopleAtCompany, setPeopleAtCompany] = useState<PersonAtCompany[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [companyMeta, setCompanyMeta] = useState<CompanyMeta | null>(null);
  const [companyMetaLoading, setCompanyMetaLoading] = useState(true);
  const [nexaOpen, setNexaOpen] = useState(false);

  useEffect(() => {
    if (!company) {
      setPeopleLoading(false);
      return;
    }
    setPeopleLoading(true);
    const params = new URLSearchParams({ company });
    if (function_) params.set("function", function_);
    if (level) params.set("level", level);
    if (school) params.set("school", school);
    params.set("limit", "2");
    fetch(`/api/people-at-company?${params}`)
      .then((res) => (res.ok ? res.json() : { people: [] }))
      .then((data) => setPeopleAtCompany(Array.isArray(data.people) ? data.people : []))
      .catch(() => setPeopleAtCompany([]))
      .finally(() => setPeopleLoading(false));
  }, [company, function_, level]);

  useEffect(() => {
    if (!company) {
      setCompanyMeta(null);
      setCompanyMetaLoading(false);
      return;
    }
    setCompanyMetaLoading(true);
    const params = new URLSearchParams({ company });
    if (function_) params.set("function", function_);
    if (level) params.set("level", level);
    fetch(`/api/company-meta?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCompanyMeta(data))
      .catch(() => setCompanyMeta(null))
      .finally(() => setCompanyMetaLoading(false));
  }, [company, function_, level]);

  function inferCareersUrlFromName(name: string | null | undefined): string | null {
    const n = (name ?? "").trim();
    if (!n) return null;
    const domain = n.toLowerCase().replace(/\s+/g, "") + ".com";
    return `https://www.${domain}/careers`;
  }

  const applyUrl = companyMeta?.careers_url ?? inferCareersUrlFromName(company) ?? "#";
  const difficulty = companyMeta?.difficulty ?? { level: "Moderate", note: "Derived from your dataset." };

  const difficultyConfig =
    difficulty.level === "Easier"
      ? { text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-400/40" }
      : difficulty.level === "Moderate"
        ? { text: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-400/40" }
        : difficulty.level === "Competitive"
          ? { text: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-400/40" }
          : { text: "text-red-400", bg: "bg-red-500/15", border: "border-red-400/40" };

  function toTitleCase(s: string): string {
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="min-h-screen bg-zinc-950" style={{ background: "var(--pg-bg)" }}>
      <header className="border-b border-emerald-500/20 bg-gradient-to-r from-zinc-900/90 to-emerald-950/20">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-xl font-semibold text-white font-brand">NextRound</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 text-sm text-emerald-400/90 hover:text-emerald-300 transition-colors"
        >
          ← Back to Recommendations
        </button>
        <div className="flex gap-8">
          <div className="min-w-0 flex-1">
            <div style={{ position: "relative", borderRadius: 16 }}>
              <GlowEffect
                colors={['#0894FF', '#C959DD', '#FF2E54', '#FF9004']}
                mode="rotate"
                blur="medium"
                duration={18}
              />
              <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-xl" style={{ position: "relative", zIndex: 1, overflow: "visible" }}>
              <div className="px-8 pt-8 pb-6 border-b border-zinc-700/80">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-4 items-start min-w-0">
                    {company && <CompanyLogo name={company} domain={domain} />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 gap-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-white">{role}</h2>
                        {matchScore != null && (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
                              matchScore >= 0.7
                                ? "bg-emerald-500/25 text-emerald-300"
                                : matchScore >= 0.5
                                  ? "bg-amber-500/25 text-amber-300"
                                  : "bg-zinc-600 text-zinc-300"
                            }`}
                          >
                            {Math.round(matchScore * 100)}% match
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-lg text-zinc-300">{company}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {function_ && (
                        <span className="rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
                          {toTitleCase(function_)}
                        </span>
                      )}
                      {level && (
                        <span className="rounded-full bg-zinc-700 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
                          {toTitleCase(level)}
                        </span>
                      )}
                    </div>
                    </div>
                  </div>
                  {/* Fixed anchor — card uses position:absolute and overflows leftward when expanded */}
                  <div className="shrink-0" style={{ position: "relative", width: 176, height: 130 }}>
                    <LocationMapCard company={company} location={location} />
                  </div>
                </div>
              </div>

              <div className="px-8 py-8 space-y-10">
                {!companyMetaLoading && companyMeta && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                      About the Company
                    </h3>

                    {/* ── Key stats row ────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {companyMeta.employee_count != null && (
                        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/60 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Employees</p>
                          <p className="text-2xl font-bold text-white tabular-nums leading-none">
                            {companyMeta.employee_count >= 1_000_000
                              ? `${(companyMeta.employee_count / 1_000_000).toFixed(1)}M`
                              : companyMeta.employee_count >= 1_000
                              ? `${(companyMeta.employee_count / 1_000).toFixed(0)}K`
                              : companyMeta.employee_count.toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/60 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Profiles in dataset</p>
                        <p className="text-2xl font-bold text-white tabular-nums leading-none">
                          {companyMeta.profiles_in_dataset.toLocaleString()}
                        </p>
                      </div>
                      <div className="nr-roles-matching px-4 py-3">
                        {companyMeta.roles_matching_filters > 0 ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1">Roles matching</p>
                            <p className="nr-roles-value text-2xl font-bold tabular-nums leading-none">
                              {companyMeta.roles_matching_filters.toLocaleString()}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-emerald-400 leading-snug">
                            Explore open roles
                          </p>
                        )}
                        <p className="text-[10px] text-emerald-600/70 mt-0.5 truncate">
                          {toTitleCase(function_)}{level ? ` · ${toTitleCase(level)}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* ── Industry + Countries ──────────────────────────────── */}
                    <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/60 px-5 py-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {companyMeta.industry && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/60 border border-zinc-600/50 px-3 py-1 text-xs font-medium text-zinc-200">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-400">
                              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                            </svg>
                            {companyMeta.industry}
                          </span>
                        )}
                        {companyMeta.domain && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/40 border border-zinc-700/50 px-3 py-1 text-xs text-zinc-400">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-500">
                              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            {companyMeta.domain}
                          </span>
                        )}
                        {companyMeta.countries.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/40 border border-zinc-700/50 px-3 py-1 text-xs text-zinc-400">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-500">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            {companyMeta.countries.slice(0, 4).join(", ")}
                            {companyMeta.countries.length > 4 && ` +${companyMeta.countries.length - 4}`}
                          </span>
                        )}
                      </div>

                      {/* ── Common titles for this role/level ────────────── */}
                      {(companyMeta.top_titles_matching_filters?.length ?? 0) > 0 && (
                        <div className="pt-2 border-t border-zinc-700/40">
                          <p className="text-xs font-medium text-zinc-400 mb-2">
                            Common titles — <span className="text-zinc-300">{toTitleCase(function_)}{level ? `, ${toTitleCase(level)}` : ""}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {companyMeta.top_titles_matching_filters.slice(0, 6).map((x) => (
                              <span key={x.title}
                                className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-200/80">
                                {x.title}
                                <span className="ml-1.5 text-emerald-600/70 text-[10px]">{x.count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── All common titles ────────────────────────────── */}
                      {(companyMeta.top_titles?.length ?? 0) > 0 && (
                        <div className="pt-2 border-t border-zinc-700/40">
                          <p className="text-xs font-medium text-zinc-400 mb-2">Most common titles overall</p>
                          <div className="flex flex-wrap gap-2">
                            {companyMeta.top_titles.slice(0, 6).map((x) => (
                              <span key={x.title}
                                className="rounded-full border border-zinc-700 bg-zinc-800/40 px-3 py-1 text-xs text-zinc-400">
                                {x.title}
                                <span className="ml-1.5 text-zinc-600 text-[10px]">{x.count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                    About the Role
                  </h3>
                  <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/60 px-5 py-4 space-y-3">
                    <p className="text-sm leading-relaxed text-zinc-300">
                      {level === "intern"
                        ? "Internship role with hands-on experience and mentorship. Typically 10–12 weeks with potential for conversion."
                        : level === "entry"
                          ? "Entry-level position. You will work with the team on real projects and grow into the function."
                          : "This role expects prior experience in the function. You will own deliverables and often mentor others."}
                    </p>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      <span className="font-medium text-zinc-300">Function:</span> {toTitleCase(function_)} — common responsibilities include collaboration with cross-functional partners, clear communication, and impact on product or engineering outcomes.
                    </p>
                    {matchReasons.length > 0 && (
                      <p className="text-sm leading-relaxed text-zinc-400">
                        <span className="font-medium text-zinc-300">Why this role fits you:</span>{" "}
                        {matchReasons.join("; ")}.
                      </p>
                    )}
                    {!companyMetaLoading && companyMeta && (companyMeta.top_titles_matching_filters?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-zinc-700/60 mt-2">
                        <p className="text-xs font-medium text-zinc-400">
                          Common titles for this level &amp; function at {companyMeta.company} (from your dataset)
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {companyMeta.top_titles_matching_filters.slice(0, 6).map((x) => (
                            <span
                              key={x.title}
                              className="rounded-full border border-zinc-600 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300"
                            >
                              {x.title} <span className="text-zinc-500">({x.count})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                    Difficulty to Get This Job
                  </h3>
                  <div className={`rounded-xl border px-5 py-4 ${difficultyConfig.bg} ${difficultyConfig.border}`}>
                    <p className="text-xs text-zinc-500 mb-3">
                      Based on LiveDataTechnologies workforce data — hiring patterns, level, and company demand.
                    </p>
                    <p className={`inline-block rounded-lg px-3 py-1.5 text-sm font-semibold ${difficultyConfig.text} ${difficultyConfig.bg} border ${difficultyConfig.border}`}>
                      {difficulty.level}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{difficulty.note}</p>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                      Why We Recommended This Role
                    </h3>
                    {matchScore != null && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                        matchScore >= 0.7 ? "bg-emerald-500/20 text-emerald-300" : matchScore >= 0.5 ? "bg-amber-500/20 text-amber-300" : "bg-zinc-700 text-zinc-300"
                      }`}>
                        {Math.round(matchScore * 100)}% match
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/60 px-5 py-4 divide-y divide-zinc-700/40">
                    {matchReasons.length > 0 ? (
                      matchReasons.map((r, i) => (
                        <div key={i} className={`flex gap-3 ${i > 0 ? "pt-3 mt-3" : ""}`}>
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                          <div>
                            <p className="text-sm font-medium text-zinc-200 leading-snug">{r}</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{expandMatchReason(r)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">Matched to your career pathway based on LiveData workforce patterns.</p>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                    People who worked at {company}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    LiveDataTechnologies workforce data: professionals who worked at this company with similar career pathways. Connect on LinkedIn for insights.
                  </p>
                  {peopleLoading ? (
                    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-5 py-8 text-center text-sm text-zinc-500">
                      Loading…
                    </div>
                  ) : peopleAtCompany.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {peopleAtCompany.slice(0, 2).map((p) => (
                        <ProfileRevealCard
                          key={p.id}
                          fullName={p.display_name}
                          careerRoute={p.job_history_summary}
                          linkedInUrl={p.linkedin_url}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-5 py-6 text-sm text-zinc-500">
                      <p className="text-center">No workforce profiles found for this company in LiveDataTechnologies.</p>
                      <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                        <span>Try searching for employees directly on</span>
                        <a
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}&origin=GLOBAL_SEARCH_HEADER`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors font-medium"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                          {company} on LinkedIn
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
            </div>
          </div>

          <aside className="w-44 shrink-0">
            <div className="sticky top-24 flex flex-col gap-3">
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500/50 bg-transparent px-5 py-3.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors w-full"
              >
                Apply
              </a>
              <Link
                href={`/interview?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&function=${encodeURIComponent(function_)}`}
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-emerald-500 px-5 py-4 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors w-full text-center"
              >
                Mock Behavioral Interview
              </Link>
              <Link
                href={`/interview-technical?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&function=${encodeURIComponent(function_)}`}
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-blue-500 px-5 py-4 text-sm font-semibold text-white hover:bg-blue-400 transition-colors w-full text-center"
              >
                Mock Technical Interview
              </Link>
              <NexaButton onClick={() => setNexaOpen(true)} />
            </div>
          </aside>
          {nexaOpen && <NexaIsland onClose={() => setNexaOpen(false)} />}
        </div>
      </main>
    </div>
  );
}

export default function RolePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Loading…</div>
      }
    >
      <RoleContent />
    </Suspense>
  );
}
