import { NextResponse } from "next/server";
import { getPeopleWhoWorkedAtCompany, formatShortJobHistory } from "@/lib/people-at-company";
import { loadLiveData } from "@/lib/live-data-loader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim() ?? "";
  const function_ = searchParams.get("function")?.trim() ?? "";
  const level = searchParams.get("level")?.trim() ?? "";
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") ?? "3", 10) || 3));

  if (!company) {
    return NextResponse.json({ error: "Missing company" }, { status: 400 });
  }

  const dataset = loadLiveData();
  if (!dataset.length) {
    return NextResponse.json(
      { error: "Workforce dataset not loaded. Ensure live_data_persons_history_combined.json is present and valid." },
      { status: 503 }
    );
  }

  const people = getPeopleWhoWorkedAtCompany(company, dataset, {
    function: function_ || undefined,
    level: level || undefined,
    limit,
  });

  const payload = people.map((p) => ({
    id: p.id,
    display_name: p.display_name ?? "Professional",
    job_history_summary: formatShortJobHistory(p, 4),
    linkedin_url: p.linkedin_url ?? "https://www.linkedin.com",
  }));

  return NextResponse.json({ people: payload });
}
