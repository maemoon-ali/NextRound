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

    // Parallel: true total count + 300-person sample for trends/profiles
    const [countResult, dataResult] = await Promise.all([
      searchPeopleWithTotal([baseFilter], 1),
      searchPeopleWithTotal([baseFilter], 300),
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
    // Each call asks: "how many people from this school work at this company?"
    // Using size=1 so the response is instant; the API returns the true total.
    const companyRealCounts = await Promise.all(
      topCompanyNames.map(async (name) => {
        try {
          const { total } = await searchPeopleWithTotal([{
            operator: "and",
            filters: [
              // school filter (education)
              { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school], isJobsGroup: false } as LdtFilter,
              ...(major ? [{ field: "education.field", type: "must" as const, match_type: "fuzzy" as const, string_values: [major], isJobsGroup: false } as LdtFilter] : []),
              // company filter (jobs)
              { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [name] } as LdtFilter,
            ],
          }], 1);
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
        top_companies,   // real counts from full dataset
        top_functions,   // from 300-person sample
        top_locations,   // from 300-person sample
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
