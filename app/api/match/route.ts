import { NextResponse } from "next/server";
import { findSimilarPeople } from "@/lib/match";
import { loadLiveData } from "@/lib/live-data-loader";
import type { UserJobEntry, LiveDataPerson } from "@/lib/livedata-types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const job_history = Array.isArray((body as { job_history?: unknown }).job_history)
    ? (body as { job_history: UserJobEntry[] }).job_history
    : [];

  const normalized = (job_history.length > 0 ? job_history : [{ company_name: "", title: "", years_employment: 0, salary: 0, role_type: "full-time" as const, location: "" }]).map(
    (j) => ({
      company_name: typeof j.company_name === "string" ? j.company_name.trim() : "",
      title: typeof j.title === "string" ? j.title.trim() : "",
      years_employment: typeof j.years_employment === "number" && j.years_employment >= 0 ? j.years_employment : 0,
      salary: typeof j.salary === "number" && j.salary >= 0 ? j.salary : 0,
      role_type: j.role_type ?? "full-time",
      location: typeof j.location === "string" ? j.location : "",
      level: j.level,
      function: j.function,
    })
  ) as UserJobEntry[];
  const validEntries = normalized.filter((j) => j.company_name.length > 0 || j.title.length > 0);
  const entriesToUse = validEntries.length > 0 ? validEntries : ([{ company_name: "", title: "Professional", years_employment: 0, salary: 0, role_type: "full-time" as const, location: "" }] as UserJobEntry[]);

  let livePeople: LiveDataPerson[] = [];
  try {
    livePeople = loadLiveData();
  } catch (e) {
    console.warn("[api/match] loadLiveData failed:", e);
  }
  if (!livePeople.length) {
    return NextResponse.json(
      { error: "Workforce dataset not loaded. Ensure live_data_persons_history_combined.json is present and valid." },
      { status: 503 }
    );
  }

  try {
    const results = findSimilarPeople(entriesToUse, 12, livePeople);
    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error("[api/match]", e);
    return NextResponse.json({ error: "Match failed. Please try again." }, { status: 500 });
  }
}
