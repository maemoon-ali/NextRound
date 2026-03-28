import { NextRequest, NextResponse } from "next/server";
import type { TimelineStep } from "@/components/ui/career-timeline";

const LD_BASE = `https://gotlivedata.io/api/people/v1/${process.env.LIVEDATA_ORG_ID}`;
const LD_KEY  = process.env.LIVEDATA_API_KEY ?? "";

// ── Workforce.ai helpers ──────────────────────────────────────────────────────

async function ldSearch(filters: object[], size = 40): Promise<any[]> {
  try {
    const res = await fetch(`${LD_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LD_KEY}` },
      body: JSON.stringify({ filters, size }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const d = await res.json();
    return d.people ?? [];
  } catch { return []; }
}

function titleFilter(title: string) {
  return {
    operator: "and",
    filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [title] }],
  };
}

function companyFilter(name: string) {
  return {
    operator: "and",
    filters: [{ field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [name] }],
  };
}

function topN(arr: string[], n: number): string[] {
  const c: Record<string, number> = {};
  for (const v of arr) if (v?.trim()) c[v] = (c[v] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function avgYears(people: any[], field: "started_at"): number {
  const now = Date.now();
  const vals = people.flatMap(p => {
    const jobs: any[] = p.jobs ?? [];
    return jobs.map(j => {
      if (!j[field]) return null;
      const s = new Date(j[field]).getTime();
      const e = j.ended_at ? new Date(j.ended_at).getTime() : now;
      const y = (e - s) / (1000 * 60 * 60 * 24 * 365.25);
      return y > 0 && y < 50 ? y : null;
    }).filter(Boolean) as number[];
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 2;
}

function classifyCompany(name: string): TimelineStep["companyType"] {
  const n = name.toLowerCase();
  const BIG_TECH = ["google","amazon","meta","microsoft","apple","nvidia","netflix","salesforce","oracle","ibm","intel","adobe","airbnb","stripe","uber","lyft","doordash","coinbase","openai","anthropic","palantir","databricks","snowflake","linkedin","twitter","x corp","bytedance"];
  if (BIG_TECH.some(b => n.includes(b))) return "big-tech";
  if (/series [a-e]|startup|ventures|labs|\.ai$|\.io$/.test(n)) return "startup";
  return "mid-market";
}

function formatDuration(years: number): string {
  if (years < 1) return `${Math.round(years * 12)} months`;
  const lo = Math.max(1, Math.round(years * 0.8));
  const hi = Math.round(years * 1.2);
  return lo === hi ? `${lo} year${lo > 1 ? "s" : ""}` : `${lo}–${hi} years`;
}

// ── Timeline builder ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { dreamRole?: string; dreamCompany?: string; currentRole?: string; currentCompany?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { dreamRole, dreamCompany, currentRole, currentCompany } = body;
  if (!dreamRole || !dreamCompany) {
    return NextResponse.json({ error: "dreamRole and dreamCompany are required" }, { status: 400 });
  }

  // Fetch people currently in the dream role at the dream company
  const [targetPeople, titlePeople] = await Promise.all([
    ldSearch([titleFilter(dreamRole), companyFilter(dreamCompany)], 40),
    ldSearch([titleFilter(dreamRole)], 40),
  ]);

  const allPeople = [...targetPeople, ...titlePeople];

  // Extract prior jobs (jobs before the dream role)
  type PriorJob = { title: string; company: string; years: number };
  const priorJobs: PriorJob[] = [];

  for (const person of allPeople) {
    const jobs: any[] = (person.jobs ?? []).filter((j: any) =>
      j.title &&
      j.company?.name &&
      !j.title.toLowerCase().includes(dreamRole.toLowerCase().split(" ")[0])
    );
    // Sort chronologically (oldest first)
    jobs.sort((a, b) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime());
    for (const j of jobs) {
      const start = j.started_at ? new Date(j.started_at).getTime() : 0;
      const end   = j.ended_at   ? new Date(j.ended_at).getTime()   : Date.now();
      const years = Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 365.25));
      priorJobs.push({ title: j.title, company: j.company.name, years });
    }
  }

  // Group prior roles by title and pick top stepping stones
  const titleGroups: Record<string, PriorJob[]> = {};
  for (const j of priorJobs) {
    const key = j.title.toLowerCase().trim();
    if (!titleGroups[key]) titleGroups[key] = [];
    titleGroups[key].push(j);
  }

  // Score: frequency × recency weight
  const scored = Object.entries(titleGroups)
    .map(([, jobs]) => ({
      title: jobs[0].title,
      company: topN(jobs.map(j => j.company), 1)[0] ?? "Various companies",
      count: jobs.length,
      avgYears: jobs.reduce((s, j) => s + j.years, 0) / jobs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Build timeline steps
  const steps: TimelineStep[] = [];

  // Step 0: current position
  if (currentRole) {
    steps.push({
      id: "current",
      year: "Now",
      title: currentRole,
      company: currentCompany ?? "Your current company",
      companyType: currentCompany ? classifyCompany(currentCompany) : "any",
      duration: "",
      why: "",
      isCurrent: true,
    });
  }

  // Middle stepping stones (up to 3 main steps)
  const mainSteps = scored.slice(0, 3);
  const altPool   = scored.slice(3);

  let yearCursor = 0;
  for (let i = 0; i < mainSteps.length; i++) {
    const s = mainSteps[i];
    const lo = Math.max(1, Math.round(yearCursor + 1));
    const hi = Math.round(yearCursor + s.avgYears + 1);
    yearCursor = hi;

    const alts = altPool.slice(i, i + 2).map(a => ({
      title: a.title,
      company: a.company,
      why: `${a.count} people who became ${dreamRole} at ${dreamCompany} also took this route.`,
    }));

    const pct = Math.round((s.count / allPeople.length) * 100);

    steps.push({
      id: `step-${i}`,
      year: `Year ${lo}${hi !== lo ? `–${hi}` : ""}`,
      title: s.title,
      company: s.company,
      companyType: classifyCompany(s.company),
      duration: formatDuration(s.avgYears),
      why: `${s.count} of the ${allPeople.length} professionals who reached ${dreamRole} at ${dreamCompany} held this role on the way there.`,
      probability: pct > 0 ? pct : undefined,
      alternatives: alts.length > 0 ? alts : undefined,
    });
  }

  // Final: dream role
  const finalYear = yearCursor + 1;
  steps.push({
    id: "target",
    year: `Year ${finalYear}+`,
    title: dreamRole,
    company: dreamCompany,
    companyType: classifyCompany(dreamCompany),
    duration: "",
    why: `This is your target. ${allPeople.length} professionals in the workforce dataset currently hold this role.`,
    isTarget: true,
  });

  return NextResponse.json({
    steps,
    totalProfessionals: allPeople.length,
    dreamRole,
    dreamCompany,
  });
}
