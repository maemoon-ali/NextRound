import { NextResponse } from "next/server";
import { getPeopleAtCompany } from "@/lib/livedata-api";
import { formatShortJobHistory } from "@/lib/people-at-company";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim() ?? "";
  const function_ = searchParams.get("function")?.trim() ?? "";
  const level = searchParams.get("level")?.trim() ?? "";
  const school = searchParams.get("school")?.trim() ?? "";
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") ?? "2", 10) || 2));

  if (!company) {
    return NextResponse.json({ error: "Missing company" }, { status: 400 });
  }

  try {
    const people = await getPeopleAtCompany(company, {
      function: function_ || undefined,
      level: level || undefined,
      limit,
      school: school || undefined,
    });

    const payload = people.map((p) => ({
      id: p.id,
      display_name: p.display_name ?? p.current_position.title ?? "Professional",
      job_history_summary: formatShortJobHistory(p, 4),
      linkedin_url: p.linkedin_url ?? "https://www.linkedin.com",
    }));

    return NextResponse.json({ people: payload });
  } catch (e) {
    console.error("[api/people-at-company]", e);
    return NextResponse.json({ error: "Failed to fetch people data." }, { status: 500 });
  }
}
