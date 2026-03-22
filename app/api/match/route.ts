import { NextResponse } from "next/server";
import { findSimilarPeople } from "@/lib/match";
import { searchPeople, toApiFunction, type LdtFilter } from "@/lib/livedata-api";
import type { UserJobEntry, UserEducationEntry, LiveDataPerson } from "@/lib/livedata-types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const job_history: UserJobEntry[] = Array.isArray(
    (body as { job_history?: unknown }).job_history,
  )
    ? (body as { job_history: UserJobEntry[] }).job_history
    : [];

  const education: UserEducationEntry[] = Array.isArray(
    (body as { education?: unknown }).education,
  )
    ? (body as { education: UserEducationEntry[] }).education
    : [];

  // ── Normalise incoming job history ─────────────────────────────────────────
  const normalized = (
    job_history.length > 0
      ? job_history
      : [{ company_name: "", title: "", years_employment: 0, salary: 0, role_type: "full-time" as const, location: "" }]
  ).map((j) => ({
    company_name:     typeof j.company_name === "string"    ? j.company_name.trim()   : "",
    title:            typeof j.title === "string"            ? j.title.trim()           : "",
    years_employment: typeof j.years_employment === "number" && j.years_employment >= 0 ? j.years_employment : 0,
    salary:           typeof j.salary === "number"           && j.salary >= 0            ? j.salary           : 0,
    role_type:        j.role_type ?? "full-time",
    location:         typeof j.location === "string"         ? j.location               : "",
    level:            j.level,
    function:         j.function,
  })) as UserJobEntry[];

  const validEntries = normalized.filter((j) => j.company_name.length > 0 || j.title.length > 0);
  const entriesToUse =
    validEntries.length > 0
      ? validEntries
      : ([{ company_name: "", title: "Professional", years_employment: 0, salary: 0, role_type: "full-time" as const, location: "" }] as UserJobEntry[]);

  // Derive approximate start years from years_employment for career-timing scoring
  const currentYear   = new Date().getFullYear();
  const userStartYears = entriesToUse.map((j) =>
    Math.round(currentYear - Math.max(0, j.years_employment ?? 0)),
  );

  // ── Build search signals ───────────────────────────────────────────────────
  const userTitles       = [...new Set(entriesToUse.map((j) => j.title).filter((t) => t.length > 1))].slice(0, 6);
  const userCompanies    = [...new Set(entriesToUse.map((j) => j.company_name).filter((c) => c.length > 1))].slice(0, 6);
  const userApiFunctions = [...new Set(entriesToUse.map((j) => toApiFunction(j.function)).filter(Boolean) as string[])];

  // When the user lists any internship-type role, also search for "intern"
  // so the API pool contains a mix of intern-titled and regular results.
  const hasInternshipRole = entriesToUse.some((j) => {
    const rt = (j.role_type ?? "").toLowerCase();
    return rt.includes("intern") || rt === "trainee" || rt === "apprentice";
  });
  // Titles used for the ACTIVE stage — add "intern" when user is an intern
  // but cap total at 7 so we don't over-broaden the query.
  const activeTitles = hasInternshipRole
    ? [...new Set([...userTitles, "intern"])].slice(0, 7)
    : userTitles;

  /**
   * Two-stage search strategy:
   *
   * STAGE 1 — ACTIVE (primary):
   *   People CURRENTLY working with the user's job titles.
   *   jobsGroupType:"active" ensures we get live, current roles.
   *   → "Cook" returns people currently working as Cooks, Head Cooks, etc.
   *
   * STAGE 2 — HISTORICAL (breadth):
   *   Past titles + companies + functions across anyone's full history.
   *   Adds career-progression matches and cross-functional pathways.
   *
   * Both pools flow through the 9-signal findSimilarPeople scorer which
   * considers title, level, role type, salary band, company, timing, etc.
   */
  try {
    // ── STAGE 1: Active title search ─────────────────────────────────────────
    const activeFilters: LdtFilter[] = [];
    if (activeTitles.length > 0) {
      activeFilters.push({
        operator: "and",
        isJobsGroup: true,
        jobsGroupType: "active",
        positionStatus: "all",
        filters: [
          { field: "jobs.title", type: "must", match_type: "fuzzy", string_values: activeTitles },
        ],
      });
    }

    // ── STAGE 2: Historical breadth search ───────────────────────────────────
    const historyBranches: LdtFilter[] = [];
    if (userTitles.length > 0) {
      historyBranches.push({
        operator: "and",
        isJobsGroup: true,
        jobsGroupType: "any",
        positionStatus: "all",
        filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: userTitles }],
      });
    }
    if (userCompanies.length > 0) {
      historyBranches.push({
        operator: "and",
        isJobsGroup: true,
        jobsGroupType: "any",
        positionStatus: "all",
        filters: [{ field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: userCompanies }],
      });
    }
    if (userApiFunctions.length > 0) {
      historyBranches.push({
        operator: "and",
        isJobsGroup: true,
        jobsGroupType: "any",
        positionStatus: "all",
        filters: [{ field: "jobs.function", type: "must", match_type: "exact", string_values: userApiFunctions }],
      });
    }

    const historyFilters: LdtFilter[] =
      historyBranches.length === 0 ? [] :
      historyBranches.length === 1 ? historyBranches :
      [{ operator: "or", filters: historyBranches }];

    // ── Run both stages in parallel ───────────────────────────────────────────
    // Internship: fetch more active results so the intern-title pool is large enough
    const activeLimit = hasInternshipRole ? 200 : 150;
    const [activePeople, historyPeople] = await Promise.all([
      activeFilters.length  > 0 ? searchPeople(activeFilters,  activeLimit) : Promise.resolve([] as LiveDataPerson[]),
      historyFilters.length > 0 ? searchPeople(historyFilters, 100) : Promise.resolve([] as LiveDataPerson[]),
    ]);

    // Merge with deduplication — active results take priority
    const seenIds = new Set<string>();
    const combined: LiveDataPerson[] = [];
    for (const p of [...activePeople, ...historyPeople]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        combined.push(p);
      }
    }

    if (!combined.length) {
      return NextResponse.json(
        { error: "No workforce data returned from LiveData API. Please try different job titles." },
        { status: 503 },
      );
    }

    // Return up to 36 results (3 pages × 12), scored across all 10 signals
    const results = findSimilarPeople(entriesToUse, 36, combined, userStartYears, education);
    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error("[api/match]", e);
    return NextResponse.json({ error: "Match failed. Please try again." }, { status: 500 });
  }
}
