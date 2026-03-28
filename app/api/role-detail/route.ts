import { NextRequest, NextResponse } from "next/server";

const LD_BASE = `https://gotlivedata.io/api/people/v1/${process.env.LIVEDATA_ORG_ID}`;
const LD_KEY  = process.env.LIVEDATA_API_KEY ?? "";

async function ldSearch(filters: object[], size = 60): Promise<{ people: any[]; total: number }> {
  try {
    const res = await fetch(`${LD_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LD_KEY}` },
      body: JSON.stringify({ filters, size }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { people: [], total: 0 };
    const d = await res.json();
    return {
      people: d.people ?? [],
      // The API returns total_count = full dataset match count (not capped by size)
      total: d.total_count ?? d.total ?? d.count ?? (d.people?.length ?? 0),
    };
  } catch { return { people: [], total: 0 }; }
}

function calcMonths(start: string, end: string | null): number {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44));
}

function fmtTenure(months: number): string {
  if (months < 2) return "< 1 mo";
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y} yr${y > 1 ? "s" : ""} ${m} mo`;
}

/** Return true if `candidate` is a sufficiently good match for `target` company name */
function companyMatches(candidate: string, target: string): boolean {
  const c = candidate.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const t = target.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (c === t) return true;
  if (c.includes(t) || t.includes(c)) return true;
  // Compare meaningful words (skip noise words and short tokens)
  const stopWords = new Set(["the","and","for","inc","llc","corp","pvt","ltd","pte","gmbh","co","of","at","in","a"]);
  const sig = (s: string) => s.split(" ").filter(w => w.length > 3 && !stopWords.has(w));
  const tw = sig(t);
  const cw = sig(c);
  if (tw.length === 0) return c.includes(t.split(" ")[0] ?? t);
  // At least half of target's significant words must appear in candidate
  const hits = tw.filter(w => cw.includes(w));
  return hits.length >= Math.ceil(tw.length / 2);
}

export async function POST(req: NextRequest) {
  let body: { title?: string; company?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { title, company } = body;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const titleNorm  = title.trim().toLowerCase();
  const titleWords = titleNorm.split(/\s+/).filter(w => w.length > 2);

  const titleMatch = (jt: string): boolean => {
    const t = jt.toLowerCase();
    return titleWords.length > 1
      ? titleWords.every(w => t.includes(w))
      : t.includes(titleWords[0] ?? titleNorm);
  };

  // Pull a large enough pool using fuzzy — broad enough to feed all the stats.
  // Separately get an exact-match total for the display count so it isn't inflated.
  const { people, total: apiTotalFuzzy } = await ldSearch([{
    operator: "and",
    filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [title.trim()] }],
  }], 5000);

  const { total: apiTotalExact } = await ldSearch([{
    operator: "and",
    filters: [{ field: "jobs.title", type: "must", match_type: "exact", string_values: [title.trim()] }],
  }], 1);

  // Get the real dataset count for this role+company.
  // Use exact title matching so "Software Engineer" doesn't count "Senior Software Engineer" etc.
  // size=1 so it's a cheap call — we only need total_count.
  let roleAtCompanyTotal = 0;
  if (company?.trim()) {
    const { total } = await ldSearch([{
      operator: "and",
      filters: [
        { field: "jobs.title",        type: "must", match_type: "exact", string_values: [title.trim()] },
        { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [company.trim()] },
      ],
    }], 1);
    roleAtCompanyTotal = total;
  }


  const companyCounts: Record<string, number> = {};
  const prevCounts:    Record<string, { count: number; company: string }> = {};
  const nextCounts:    Record<string, { count: number; company: string }> = {};
  const tenures: number[] = [];
  const seenPersonIds       = new Set<string>(); // for profile dedup (capped at 5)
  const matchedPersons      = new Set<string>(); // all people who held this title (any company)
  const matchedAtCompany    = new Set<string>(); // people who held this title at this company

  const profiles: Array<{
    firstName: string; lastName: string;
    currentTitle: string; currentCompany: string;
    location?: string;
    matchedRole?: string;
    prevRole: string | null; yearsExp: number;
    pathway: { title: string; company: string; startYear: string; endYear: string | null }[];
  }> = [];

  for (const person of people) {
    const jobs: any[] = (person.jobs ?? []).sort(
      (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
    );

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!titleMatch(job.title ?? "")) continue;

      // Track matched person
      const personKey = `${person.first_name ?? ""}|${person.last_name ?? ""}`;
      matchedPersons.add(personKey);
      if (company?.trim() && job.company?.name && companyMatches(job.company.name, company.trim())) {
        matchedAtCompany.add(personKey);
      }

      // Company counts
      if (job.company?.name) {
        companyCounts[job.company.name] = (companyCounts[job.company.name] ?? 0) + 1;
      }

      // Tenure
      if (job.started_at) {
        const m = calcMonths(job.started_at, job.ended_at ?? null);
        if (m > 0 && m < 300) tenures.push(m);
      }

      // Previous role
      if (i > 0 && jobs[i - 1].title) {
        const k = jobs[i - 1].title.toLowerCase().trim();
        if (!prevCounts[k]) prevCounts[k] = { count: 0, company: jobs[i - 1].company?.name ?? "" };
        prevCounts[k].count++;
      }

      // Next role
      if (i < jobs.length - 1 && jobs[i + 1].title) {
        const k = jobs[i + 1].title.toLowerCase().trim();
        if (!nextCounts[k]) nextCounts[k] = { count: 0, company: jobs[i + 1].company?.name ?? "" };
        nextCounts[k].count++;
      }

      // Sample profiles (collect up to 5, deduplicated by person)
      if (profiles.length < 5 && !seenPersonIds.has(personKey)) {
        seenPersonIds.add(personKey);
        const current = jobs[jobs.length - 1];
        const firstJobStart = jobs.find((j: any) => j.started_at)?.started_at ?? null;
        const careerMonths = firstJobStart ? calcMonths(firstJobStart, null) : 0;
        const totalExp = Math.min(careerMonths, 45 * 12);
        const pathway = jobs
          .filter((j: any) => j.title && j.company?.name)
          .map((j: any) => ({
            title:     j.title as string,
            company:   j.company.name as string,
            startYear: j.started_at ? String(new Date(j.started_at).getFullYear()) : "—",
            endYear:   j.ended_at   ? String(new Date(j.ended_at).getFullYear())   : null,
          }));
        const loc = person.location;
        const locationStr = [loc?.city, loc?.country].filter(Boolean).join(", ");
        profiles.push({
          firstName: person.first_name ?? "—",
          lastName: (person.last_name ?? "—").slice(0, 1) + ".",
          currentTitle: current?.title ?? title,
          currentCompany: current?.company?.name ?? "",
          location: locationStr || undefined,
          matchedRole: job.title ?? undefined,
          prevRole: i > 0 ? jobs[i - 1].title : null,
          yearsExp: Math.round(totalExp / 12),
          pathway,
        });
      }
    }
  }

  const avgMonths = tenures.length > 0
    ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
    : 0;

  // ── Company-specific inflow / outflow ─────────────────────────────────────
  const companyInflowMap:  Record<string, number> = {};
  const companyOutflowMap: Record<string, number> = {};

  if (company?.trim()) {
    for (const person of people) {
      const jobs: any[] = (person.jobs ?? []).sort(
        (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
      );
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (!titleMatch(job.title ?? "")) continue;
        if (!job.company?.name || !companyMatches(job.company.name, company.trim())) continue;

        if (i > 0) {
          const prevCo = jobs[i - 1].company?.name;
          if (prevCo && !companyMatches(prevCo, company.trim())) {
            companyInflowMap[prevCo] = (companyInflowMap[prevCo] ?? 0) + 1;
          }
        }
        if (i < jobs.length - 1) {
          const nextCo = jobs[i + 1].company?.name;
          if (nextCo && !companyMatches(nextCo, company.trim())) {
            companyOutflowMap[nextCo] = (companyOutflowMap[nextCo] ?? 0) + 1;
          }
        }
      }
    }
  }

  return NextResponse.json({
    // Use exact-match totals so variants like "Senior Software Engineer" aren't counted.
    count: company?.trim()
      ? (roleAtCompanyTotal || matchedAtCompany.size)
      : (apiTotalExact || (apiTotalFuzzy > people.length ? apiTotalFuzzy : matchedPersons.size)),
    avgTenure:       avgMonths > 0 ? fmtTenure(avgMonths) : null,
    topCompanies:    Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    commonPrevRoles: Object.entries(prevCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([t, d]) => ({ title: t, ...d })),
    commonNextRoles: Object.entries(nextCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([t, d]) => ({ title: t, ...d })),
    profiles:        profiles.slice(0, 5),
    companyInflow:   Object.entries(companyInflowMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    companyOutflow:  Object.entries(companyOutflowMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
  });
}
