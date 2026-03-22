import { NextResponse } from "next/server";
import { searchPeople, toApiFunction, type LdtFilter } from "@/lib/livedata-api";

export interface InterviewRoleResult {
  role: string;
  company: string;
  domain: string;
  function: string;
  level: string;
}

/**
 * GET /api/interview-roles?q=software+engineer&type=behavioral
 *
 * Searches workforce.ai for people currently in roles matching the query,
 * then returns deduplicated { role, company, domain, function, level } objects.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ roles: [] });
  }

  try {
    const filters: LdtFilter[] = [
      {
        operator: "and",
        isJobsGroup: true,
        jobsGroupType: "active",
        positionStatus: "all",
        filters: [
          {
            field: "jobs.title",
            type: "must",
            match_type: "fuzzy",
            string_values: [q],
          },
        ],
      },
    ];

    const people = await searchPeople(filters, 60);

    // Deduplicate by "role|company" key, collecting unique combos
    const seen = new Set<string>();
    const roles: InterviewRoleResult[] = [];

    for (const person of people) {
      const pos = person.current_position;
      const role = pos.title?.trim();
      const company = pos.company?.name?.trim();
      const domain = pos.company?.domain?.trim() ?? "";
      const fn = pos.function ?? "engineering";
      const level = pos.level ?? "entry";

      if (!role || !company) continue;

      const key = `${role.toLowerCase()}|${company.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      roles.push({ role, company, domain, function: fn, level });

      // Cap at 20 unique results
      if (roles.length >= 20) break;
    }

    return NextResponse.json({ roles });
  } catch (err) {
    console.error("[interview-roles]", err);
    return NextResponse.json({ roles: [] });
  }
}
