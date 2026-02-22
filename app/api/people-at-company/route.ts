import { NextResponse } from "next/server";
import { getPeopleWhoWorkedAtCompany, formatShortJobHistory } from "@/lib/people-at-company";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim() ?? "";
  const function_ = searchParams.get("function")?.trim() ?? "";
  const level = searchParams.get("level")?.trim() ?? "";
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") ?? "3", 10) || 3));

  if (!company) {
    return NextResponse.json({ error: "Missing company" }, { status: 400 });
  }

  const people = getPeopleWhoWorkedAtCompany(company, {
    function: function_ || undefined,
    level: level || undefined,
    limit,
  });

  const payload = people.map((p) => ({
    id: p.id,
    display_name: p.display_name ?? "Professional",
    job_history_summary: formatShortJobHistory(p),
    linkedin_url: p.linkedin_url ?? "https://www.linkedin.com",
  }));

  return NextResponse.json({ people: payload });
}
