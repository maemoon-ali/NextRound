import { NextResponse } from "next/server";
import { searchPeopleWithTotal } from "@/lib/livedata-api";
import { formatShortJobHistory } from "@/lib/people-at-company";
import type { LdtFilter } from "@/lib/livedata-api";

const FUNCTION_LABELS: Record<string, string> = {
  engineering:            "Engineering & Infrastructure",
  information_technology: "Engineering & Infrastructure",
  product:                "Product & Design",
  design:                 "Product & Design",
  sales:                  "Sales & Business Dev",
  marketing:              "Marketing & Growth",
  operations:             "Operations & Strategy",
  finance:                "Finance & Administration",
  data_science:           "Data Science & Research",
  customer_success:       "Customer Success",
  legal:                  "Legal & Compliance",
  human_resources:        "People & HR",
};

const EDU_KEYWORDS = ["university", "college", "school", "institute", "academy", "polytechnic", "seminary"];
const isEduInstitution = (name: string) =>
  EDU_KEYWORDS.some(kw => name.toLowerCase().includes(kw));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const school = searchParams.get("school")?.trim() ?? "";
  const major  = searchParams.get("major")?.trim()  ?? "";

  if (!school) {
    return NextResponse.json({ error: "Missing school" }, { status: 400 });
  }

  try {
    const baseFilter: LdtFilter = {
      operator: "and",
      isJobsGroup: false,
      filters: [
        { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school] },
        ...(major ? [{ field: "education.field", type: "must" as const, match_type: "fuzzy" as const, string_values: [major] }] : []),
      ],
    };

    // Date threshold for "surge" query — alumni who started a job in the last 2 years
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const surgeDateFrom = twoYearsAgo.toISOString().slice(0, 10);

    const eduFiltersBase: LdtFilter[] = [
      { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school] },
      ...(major ? [{ field: "education.field", type: "must" as const, match_type: "fuzzy" as const, string_values: [major] }] : []),
    ];

    // Parallel: true total count + 300-person sample + surge (recent hires from school)
    const [countResult, dataResult, surgeResult] = await Promise.all([
      searchPeopleWithTotal([baseFilter], 1),
      searchPeopleWithTotal([baseFilter], 300),
      searchPeopleWithTotal([
        { operator: "and", isJobsGroup: false, filters: eduFiltersBase },
        { operator: "and", isJobsGroup: true,  filters: [
          { field: "jobs.started_at", type: "must", date_from: surgeDateFrom },
        ]},
      ], 200).catch(() => ({ people: [], total: 0 })),
    ]);

    const realTotal = countResult.total;
    const people    = dataResult.people;

    if (people.length === 0) {
      return NextResponse.json({ alumni: [], trends: null, school, major });
    }

    // ── Aggregate from 300-person sample ──────────────────────────────────
    const companyCounts  = new Map<string, number>();
    const functionCounts = new Map<string, number>();
    const locationCounts = new Map<string, number>();
    let   seniorCount    = 0;

    for (const p of people) {
      const co = p.current_position.company.name?.trim();
      if (co) companyCounts.set(co, (companyCounts.get(co) ?? 0) + 1);

      const fn = p.current_position.function;
      if (fn) {
        const label = FUNCTION_LABELS[fn] ?? fn;
        functionCounts.set(label, (functionCounts.get(label) ?? 0) + 1);
      }

      const loc = (p.current_position.location ?? "").split(",").pop()?.trim();
      if (loc && loc.length > 1) locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);

      const lvl = p.current_position.level;
      if (["senior", "manager", "director", "vp", "c_suite"].includes(lvl ?? "")) seniorCount++;
    }

    // Top company names from sample (excluding edu institutions)
    const topCompanyNames = [...companyCounts.entries()]
      .filter(([name]) => !isEduInstitution(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    // ── Real counts: parallel API query per company filtered by school ────
    // Education and job filters MUST be separate nested groups with their own
    // isJobsGroup flags — mixing them in one flat group causes severely low counts.
    const eduFilters: LdtFilter[] = [
      { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school] },
      ...(major ? [{ field: "education.field", type: "must" as const, match_type: "fuzzy" as const, string_values: [major] }] : []),
    ];
    const companyRealCounts = await Promise.all(
      topCompanyNames.map(async (name) => {
        try {
          const { total } = await searchPeopleWithTotal([
            // Education group — must have isJobsGroup: false
            { operator: "and", isJobsGroup: false, filters: eduFilters },
            // Job group — must have isJobsGroup: true, separate from edu group
            { operator: "and", isJobsGroup: true, filters: [
              { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [name] },
            ]},
          ], 1);
          return { name, total };
        } catch {
          // Fallback to sample count if the compound query fails
          return { name, total: companyCounts.get(name) ?? 0 };
        }
      })
    );

    const top_companies = companyRealCounts
      .sort((a, b) => b.total - a.total)
      .map(({ name, total }) => ({
        name,
        count: total,                                          // real count from full dataset
        pct:   Math.round((total / realTotal) * 100),
      }));

    const top_functions = [...functionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / people.length) * 100),
      }));

    const top_locations = [...locationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const seniorPct = Math.round((seniorCount / people.length) * 100);

    // ── Surge companies: find jobs that ACTUALLY started recently ────────
    // For each person returned by the date-filtered query, walk their jobs
    // (current first, then history) and find the one that started within
    // the surge window.  Using current_position alone was inaccurate because
    // many people have already moved on from the recently-started role.
    const surgeCounts  = new Map<string, number>();
    const surgeDomains = new Map<string, string>();

    for (const p of surgeResult.people) {
      const allJobs = [p.current_position, ...p.job_history];
      for (const job of allJobs) {
        const startedAt = job.started_at ?? "";
        // Skip the default fallback date injected when the real date is unknown
        if (!startedAt || startedAt.startsWith("2020-01-01")) continue;
        // Only count if within the surge window
        if (startedAt < surgeDateFrom) continue;
        const coName = job.company.name?.trim();
        if (!coName || isEduInstitution(coName)) continue;
        surgeCounts.set(coName, (surgeCounts.get(coName) ?? 0) + 1);
        if (!surgeDomains.has(coName) && job.company.domain) {
          surgeDomains.set(coName, job.company.domain);
        }
        break; // count each person at most once (their most-recent surge job)
      }
    }
    const surge_companies = [...surgeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, recent_count]) => ({
        name,
        recent_count,
        domain: surgeDomains.get(name) ?? null,
      }));

    // ── Alumni profile cards ───────────────────────────────────────────────
    const alumni = people.slice(0, 24).map((p) => ({
      id:               p.id,
      display_name:     p.display_name ?? null,
      current_title:    p.current_position.title,
      current_company:  p.current_position.company.name,
      current_location: p.current_position.location ?? "",
      current_function: FUNCTION_LABELS[p.current_position.function ?? ""] ?? p.current_position.function ?? "",
      current_level:    p.current_position.level ?? "",
      job_history_summary: formatShortJobHistory(p, 4),
      linkedin_url:     p.linkedin_url ?? null,
    }));

    return NextResponse.json({
      alumni,
      trends: {
        top_companies,    // real counts from full dataset
        top_functions,    // from 300-person sample
        top_locations,    // from 300-person sample
        surge_companies,  // companies with most recent hires from this school
        total:      realTotal,
        sample:     people.length,
        senior_pct: seniorPct,
      },
      school,
      major,
    });
  } catch (e) {
    console.error("[api/alumni]", e);
    return NextResponse.json({ error: "Failed to fetch alumni data." }, { status: 500 });
  }
}
