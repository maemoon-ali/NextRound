import { NextResponse } from "next/server";
import { searchPeopleWithTotal } from "@/lib/livedata-api";
import { formatShortJobHistory } from "@/lib/people-at-company";
import type { LdtFilter } from "@/lib/livedata-api";

const FUNCTION_LABELS: Record<string, string> = {
  engineering:        "Engineering & Infrastructure",
  information_technology: "Engineering & Infrastructure",
  product:            "Product & Design",
  design:             "Product & Design",
  sales:              "Sales & Business Dev",
  marketing:          "Marketing & Growth",
  operations:         "Operations & Strategy",
  finance:            "Finance & Administration",
  data_science:       "Data Science & Research",
  customer_success:   "Customer Success",
  legal:              "Legal & Compliance",
  human_resources:    "People & HR",
};

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

    // Run two calls in parallel:
    //   1. size=1  → get the API's true total match count
    //   2. size=300 → large sample for meaningful trends & profiles
    const [countResult, dataResult] = await Promise.all([
      searchPeopleWithTotal([baseFilter], 1),
      searchPeopleWithTotal([baseFilter], 300),
    ]);

    const realTotal = countResult.total;   // API's true count (e.g. 4 200)
    const people    = dataResult.people;   // up to 300 mapped people

    if (people.length === 0) {
      return NextResponse.json({ alumni: [], trends: null, school, major });
    }

    // ── Aggregate trends over the full 300-person sample ───────────────────
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
      if (lvl === "senior" || lvl === "manager" || lvl === "director" || lvl === "vp" || lvl === "c_suite") {
        seniorCount++;
      }
    }

    const top_companies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / people.length) * 100),
      }));

    // Merge function labels that map to same bucket
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

    // ── Individual alumni cards (first 24) ────────────────────────────────
    const alumni = people.slice(0, 24).map((p) => ({
      id: p.id,
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
        top_companies,
        top_functions,
        top_locations,
        total:      realTotal,        // true API count
        sample:     people.length,    // how many we analysed for trends
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
