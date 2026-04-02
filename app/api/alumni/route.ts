import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/livedata-api";
import { formatShortJobHistory } from "@/lib/people-at-company";
import type { LdtFilter } from "@/lib/livedata-api";

const FUNCTION_LABELS: Record<string, string> = {
  engineering: "Engineering",
  product: "Product",
  design: "Design",
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  finance: "Finance",
  data_science: "Data Science",
  customer_success: "Customer Success",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const school = searchParams.get("school")?.trim() ?? "";
  const major  = searchParams.get("major")?.trim()  ?? "";

  if (!school) {
    return NextResponse.json({ error: "Missing school" }, { status: 400 });
  }

  try {
    // Fetch more people than we display so trends are meaningful
    const filters: LdtFilter[] = [
      {
        operator: "and",
        isJobsGroup: false,
        filters: [
          { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school] },
          ...(major ? [{ field: "education.field", type: "must" as const, match_type: "fuzzy" as const, string_values: [major] }] : []),
        ],
      },
    ];

    const people = await searchPeople(filters, 50);

    if (people.length === 0) {
      return NextResponse.json({ alumni: [], trends: null, school, major });
    }

    // ── Aggregate company trends ────────────────────────────────────────────
    const companyCounts = new Map<string, number>();
    const functionCounts = new Map<string, number>();

    for (const p of people) {
      const co = p.current_position.company.name?.trim();
      if (co) companyCounts.set(co, (companyCounts.get(co) ?? 0) + 1);

      const fn = p.current_position.function;
      if (fn) functionCounts.set(fn, (functionCounts.get(fn) ?? 0) + 1);
    }

    const top_companies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / people.length) * 100),
      }));

    const top_functions = [...functionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([fn, count]) => ({
        name: FUNCTION_LABELS[fn] ?? fn,
        count,
        pct: Math.round((count / people.length) * 100),
      }));

    // ── Individual alumni cards (first 15) ─────────────────────────────────
    const alumni = people.slice(0, 15).map((p) => ({
      id: p.id,
      current_title: p.current_position.title,
      current_company: p.current_position.company.name,
      current_location: p.current_position.location ?? "",
      current_function: FUNCTION_LABELS[p.current_position.function ?? ""] ?? "",
      job_history_summary: formatShortJobHistory(p, 4),
      linkedin_url: p.linkedin_url ?? null,
    }));

    return NextResponse.json({
      alumni,
      trends: { top_companies, top_functions, total: people.length },
      school,
      major,
    });
  } catch (e) {
    console.error("[api/alumni]", e);
    return NextResponse.json({ error: "Failed to fetch alumni data." }, { status: 500 });
  }
}
