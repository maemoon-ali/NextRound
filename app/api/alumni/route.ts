import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/livedata-api";
import { formatShortJobHistory } from "@/lib/people-at-company";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const school = searchParams.get("school")?.trim() ?? "";
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  if (!school) {
    return NextResponse.json({ error: "Missing school" }, { status: 400 });
  }

  try {
    const people = await searchPeople(
      [
        {
          operator: "and",
          filters: [
            {
              field: "educations.school_name",
              type: "must",
              match_type: "fuzzy",
              string_values: [school],
            },
          ],
        },
      ],
      limit
    );

    const payload = people.map((p) => ({
      id: p.id,
      display_name: p.display_name ?? p.current_position.title ?? "Alumni",
      current_title: p.current_position.title,
      current_company: p.current_position.company.name,
      current_location: p.current_position.location ?? "",
      job_history_summary: formatShortJobHistory(p, 4),
      linkedin_url: p.linkedin_url ?? null,
    }));

    return NextResponse.json({ alumni: payload, school });
  } catch (e) {
    console.error("[api/alumni]", e);
    return NextResponse.json({ error: "Failed to fetch alumni data." }, { status: 500 });
  }
}
