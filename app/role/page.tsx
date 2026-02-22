"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { COMPANY_CAREERS } from "@/lib/mock-livedata";

type PersonAtCompany = {
  id: string;
  display_name: string;
  job_history_summary: string;
  linkedin_url: string;
};
import { COMPANY_INFO, getDifficulty } from "@/lib/company-info";
import { saveBookmark, removeBookmark, isBookmarked } from "@/lib/bookmarks";

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
          alt=""
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

function RoleContent() {
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
  const scoreParam = searchParams.get("score");
  const matchScore: number | null =
    scoreParam != null && scoreParam !== ""
      ? (() => {
          const n = parseFloat(scoreParam);
          return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
        })()
      : null;

  const [bookmarked, setBookmarked] = useState(false);
  const [peopleAtCompany, setPeopleAtCompany] = useState<PersonAtCompany[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  useEffect(() => {
    setBookmarked(isBookmarked(company, role));
  }, [company, role]);

  useEffect(() => {
    if (!company) {
      setPeopleLoading(false);
      return;
    }
    setPeopleLoading(true);
    const params = new URLSearchParams({ company });
    if (function_) params.set("function", function_);
    if (level) params.set("level", level);
    fetch(`/api/people-at-company?${params}`)
      .then((res) => (res.ok ? res.json() : { people: [] }))
      .then((data) => setPeopleAtCompany(Array.isArray(data.people) ? data.people : []))
      .catch(() => setPeopleAtCompany([]))
      .finally(() => setPeopleLoading(false));
  }, [company, function_, level]);

  const applyUrl = company
    ? COMPANY_CAREERS[company] ?? `https://www.${company.toLowerCase().replace(/\s+/g, "")}.com/careers`
    : "#";

  const companyInfo = company ? COMPANY_INFO[company] : null;
  const difficulty = getDifficulty(company, level);

  function handleBookmark() {
    if (bookmarked) {
      removeBookmark(company, role);
      setBookmarked(false);
    } else {
      saveBookmark({ company, role, location, function: function_, level, reasons: matchReasons });
      setBookmarked(true);
    }
  }

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
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-emerald-500/20 bg-gradient-to-r from-zinc-900/90 to-emerald-950/20">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <Link href="/prepare" className="text-sm text-emerald-400/90 hover:text-emerald-300">
            ← Back to Recommendations
          </Link>
          <h1 className="text-xl font-semibold text-white mt-2 font-brand">NextRound</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex gap-8">
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/60 shadow-xl overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-zinc-700/80">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-4 items-start min-w-0">
                    {company && <CompanyLogo name={company} />}
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
                    {location && <p className="mt-1.5 text-sm text-zinc-500">{location}</p>}
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
                  <button
                    type="button"
                    onClick={handleBookmark}
                    className="shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/80 p-3 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400 transition-colors"
                    title={bookmarked ? "Remove from Saved" : "Save to Saved"}
                    aria-label={bookmarked ? "Remove from Saved" : "Save to Saved"}
                  >
                    {bookmarked ? (
                      <svg className="h-6 w-6 fill-amber-400 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="px-8 py-8 space-y-10">
                {companyInfo && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                      About the Company
                    </h3>
                    <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/60 px-5 py-4">
                      <p className="text-sm leading-relaxed text-zinc-300">{companyInfo.description}</p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>{companyInfo.industry}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{companyInfo.employeeCount} Employees</span>
                      </div>
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
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                    Why This Role Was Matched to You
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    This role was selected using LiveDataTechnologies workforce data: we compare your job history (company, title, function, level, and location) to professionals in the dataset and surface roles that align with your career pathway. The match score and reasons below reflect how closely this opportunity fits your profile.
                  </p>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">What we considered</p>
                  <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-zinc-300">Job level</strong> — How your experience (e.g. intern, entry, senior) lines up with this role’s level.</li>
                    <li><strong className="text-zinc-300">Function</strong> — Whether your background is in the same area (e.g. engineering, product, design).</li>
                    <li><strong className="text-zinc-300">Company & title</strong> — Similarity of your past roles and companies to this role and employer.</li>
                    <li><strong className="text-zinc-300">Location</strong> — If you listed locations, we favor roles in the same city or region.</li>
                  </ul>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide pt-1">
                    Why we recommended this role for you
                    {matchScore != null && (
                      <span className="ml-2 font-semibold normal-case text-emerald-400">
                        — {Math.round(matchScore * 100)}% match to your profile
                      </span>
                    )}
                  </p>
                  {matchReasons.length > 0 ? (
                    <ul className="space-y-4">
                      {matchReasons.map((r, i) => (
                        <li key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                          <p className="flex items-start gap-2.5 text-sm font-medium text-emerald-300/95">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
                            {r}
                          </p>
                          <p className="mt-2 pl-5 text-sm leading-relaxed text-zinc-400">
                            {expandMatchReason(r)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                      <p className="text-sm text-zinc-500 italic">Matches your career pathway based on LiveDataTechnologies workforce patterns.</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {expandMatchReason("Matches your career pathway based on LiveDataTechnologies workforce patterns.")}
                      </p>
                    </div>
                  )}
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
                    <div className="grid gap-4 sm:grid-cols-1">
                      {peopleAtCompany.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-5 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white">{p.display_name}</p>
                              <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
                                {p.job_history_summary}
                              </p>
                            </div>
                            <a
                              href={p.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3.5 py-2 text-sm font-medium text-sky-400 hover:bg-zinc-700 hover:text-sky-300 transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                              </svg>
                              LinkedIn
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-5 py-6 text-center text-sm text-zinc-500">
                      No workforce profiles found for this company in LiveDataTechnologies.
                    </div>
                  )}
                </section>
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
                Start Mock Interview
              </Link>
              <Link
                href={`/interview-technical?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&function=${encodeURIComponent(function_)}`}
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-blue-500 px-5 py-4 text-sm font-semibold text-white hover:bg-blue-400 transition-colors w-full text-center"
              >
                Mock Technical Interview
              </Link>
            </div>
          </aside>
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
