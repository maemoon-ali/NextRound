import { NextRequest, NextResponse } from "next/server";
import type { UserJobEntry, UserEducationEntry, DegreeType } from "@/lib/livedata-types";

const LIVEDATA_API_KEY = process.env.LIVEDATA_API_KEY;
const LIVEDATA_API_URL = process.env.LIVEDATA_API_URL ?? "https://gotlivedata.io/api/people/v1";
const LIVEDATA_ORG_ID = process.env.LIVEDATA_ORG_ID ?? "";

function extractLinkedInSlug(input: string): string {
  const trimmed = input.trim().replace(/\/$/, "");
  const match = trimmed.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (match) return match[1];
  return trimmed;
}

function calcYears(startedAt?: string, endedAt?: string): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.round(years * 10) / 10);
}

interface RawCompany {
  name?: string;
}

interface RawJob {
  title?: string;
  level?: string;
  function?: string;
  started_at?: string;
  ended_at?: string;
  location?: string;
  salary?: number;
  company?: RawCompany;
  company_name?: string;
}

interface RawEducation {
  school?: { name?: string };
  school_name?: string;
  degree?: string;
  field_of_study?: string;
  major?: string;
  started_at?: string;
  ended_at?: string;
  start_year?: number;
  end_year?: number;
}

interface RawPerson {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  position?: RawJob;
  jobs?: RawJob[];
  education?: RawEducation[];
  schools?: RawEducation[];
}

function mapJob(raw: RawJob): UserJobEntry {
  return {
    title: raw.title ?? "",
    company_name: raw.company?.name ?? raw.company_name ?? "",
    years_employment: calcYears(raw.started_at, raw.ended_at),
    salary: raw.salary ?? 0,
    role_type: "full-time",
    location: raw.location ?? "",
  };
}

const DEGREE_MAP: Record<string, DegreeType> = {
  bachelor: "BS", "bachelor of science": "BS", "bachelor of arts": "BA",
  "b.s.": "BS", "b.a.": "BA", bs: "BS", ba: "BA",
  "bachelor of engineering": "BEng", beng: "BEng",
  master: "MS", "master of science": "MS", "master of arts": "MA",
  "m.s.": "MS", "m.a.": "MA", ms: "MS", ma: "MA",
  mba: "MBA", "master of business administration": "MBA",
  "master of engineering": "MEng", meng: "MEng",
  "master of fine arts": "MFA", mfa: "MFA",
  phd: "PhD", "ph.d.": "PhD", "doctor of philosophy": "PhD",
  associate: "Associate",
  jd: "JD", "juris doctor": "JD",
  md: "MD", "doctor of medicine": "MD",
};

function normaliseDegree(raw?: string): DegreeType | "" {
  if (!raw) return "";
  const key = raw.toLowerCase().trim();
  for (const [k, v] of Object.entries(DEGREE_MAP)) {
    if (key.includes(k)) return v;
  }
  return "Other";
}

function mapEducation(raw: RawEducation): UserEducationEntry {
  const schoolName = raw.school?.name ?? raw.school_name ?? "";
  const startYear  = raw.start_year ?? (raw.started_at ? new Date(raw.started_at).getFullYear() : 0);
  const endYear    = raw.end_year   ?? (raw.ended_at   ? new Date(raw.ended_at).getFullYear()   : 0);
  return {
    school_name:  schoolName,
    degree_type:  normaliseDegree(raw.degree),
    major:        raw.field_of_study ?? raw.major ?? "",
    start_year:   startYear,
    end_year:     endYear,
  };
}

export async function POST(req: NextRequest) {
  let body: { linkedin_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { linkedin_url } = body;
  if (!linkedin_url?.trim()) {
    return NextResponse.json({ error: "linkedin_url is required" }, { status: 400 });
  }
  if (!LIVEDATA_API_KEY) {
    return NextResponse.json(
      { error: "Live Data API key not configured." },
      { status: 500 }
    );
  }
  if (!LIVEDATA_ORG_ID) {
    return NextResponse.json(
      { error: "Live Data org ID not configured." },
      { status: 500 }
    );
  }

  const slug = extractLinkedInSlug(linkedin_url);
  const endpoint = `${LIVEDATA_API_URL}/${LIVEDATA_ORG_ID}/find`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${LIVEDATA_API_KEY}`,
      },
      body: JSON.stringify({
        matches: [
          {
            fields: [
              { field_name: "linkedin", search_term: slug },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return NextResponse.json({ error: `Failed to reach Live Data API: ${msg}` }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json({ error: "No profile found for that LinkedIn URL." }, { status: 404 });
  }
  if (res.status === 401 || res.status === 403) {
    let detail = "";
    try {
      const errBody = await res.json() as { message?: string; error?: string };
      detail = errBody.message ?? errBody.error ?? "";
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: `API key not authorized${detail ? `: ${detail}` : ""}. Contact Live Data to enable this feature.` },
      { status: 403 }
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json() as { message?: string; error?: string };
      detail = errBody.message ?? errBody.error ?? "";
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: `Live Data API error (${res.status})${detail ? `: ${detail}` : ""}` },
      { status: 502 }
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid response from Live Data API" }, { status: 502 });
  }

  let person: RawPerson | null = null;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.matches) && d.matches.length > 0) {
      const first = d.matches[0] as { people?: RawPerson[]; found?: boolean };
      if (first.found === false || !Array.isArray(first.people) || first.people.length === 0) {
        return NextResponse.json({ error: "No profile found for that LinkedIn URL." }, { status: 404 });
      }
      person = first.people[0];
    } else if (Array.isArray(d.people) && (d.people as RawPerson[]).length > 0) {
      person = (d.people as RawPerson[])[0];
    } else if (d.id || d.name || d.position) {
      person = d as RawPerson;
    }
  }

  if (!person) {
    return NextResponse.json({ error: "No profile found for that LinkedIn URL." }, { status: 404 });
  }

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const display_name = person.name ?? (fullName || null);

  // Merge position + jobs, then deduplicate by (title, company) to prevent
  // the current role appearing twice (once in position and once in jobs[])
  const rawJobs: RawJob[] = [
    ...(person.position ? [person.position] : []),
    ...(person.jobs ?? []),
  ].filter((j) => j.title || j.company?.name || j.company_name);

  if (rawJobs.length === 0) {
    return NextResponse.json({ error: "Profile found but no job history could be extracted." }, { status: 404 });
  }

  const seen = new Set<string>();
  const jobs: UserJobEntry[] = rawJobs
    .map(mapJob)
    .filter((j) => {
      if (!j.company_name || !j.title) return false;
      const key = `${j.title.toLowerCase().trim()}|${j.company_name.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Parse education if the API returns it
  const rawEdu: RawEducation[] = person.education ?? person.schools ?? [];
  const education: UserEducationEntry[] = rawEdu
    .map(mapEducation)
    .filter((e) => e.school_name.trim().length > 0);

  return NextResponse.json({ jobs, education, display_name });
}
