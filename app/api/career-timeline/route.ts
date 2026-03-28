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

function classifyCompany(name: string): TimelineStep["companyType"] {
  const n = (name ?? "").toLowerCase();
  const BIG = ["google","amazon","meta","microsoft","apple","nvidia","netflix","salesforce",
               "oracle","ibm","intel","adobe","airbnb","stripe","uber","lyft","doordash",
               "coinbase","openai","anthropic","palantir","databricks","snowflake","linkedin",
               "twitter","x corp","bytedance","shopify","square","block","atlassian",
               "workday","servicenow","zoom","slack","twilio","github","gitlab","figma","canva"];
  if (BIG.some(b => n.includes(b))) return "big-tech";
  if (/series [a-e]|startup|ventures|labs|\.ai$|\.io$/.test(n)) return "startup";
  return "mid-market";
}

function calcDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const months = Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 2) return "< 1 mo";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y} yr${y > 1 ? "s" : ""} ${m} mo`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { linkedinUrl?: string; dreamRole?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { linkedinUrl, dreamRole } = body;
  if (!linkedinUrl?.trim()) {
    return NextResponse.json({ error: "linkedinUrl is required" }, { status: 400 });
  }

  const url = linkedinUrl.trim().replace(/\/$/, "");

  // ── 1. Try exact LinkedIn URL match ──────────────────────────────────────
  let person: any = null;

  const byUrl = await ldSearch([{
    operator: "and",
    filters: [{ field: "linkedin_url", type: "must", match_type: "fuzzy", string_values: [url] }],
  }], 5);
  person = byUrl[0] ?? null;

  // ── 2. Fallback: parse name from /in/firstname-lastname-XXXXXX ────────────
  if (!person) {
    const username = url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "";
    const segments = username.split("-").filter(s => s.length > 1 && !/^\d{4,}$/.test(s));
    if (segments.length >= 2) {
      const byName = await ldSearch([{
        operator: "and",
        filters: [
          { field: "first_name", type: "must", match_type: "fuzzy", string_values: [segments[0]] },
          { field: "last_name",  type: "must", match_type: "fuzzy", string_values: [segments[1]] },
        ],
      }], 5);
      person = byName[0] ?? null;
    }
  }

  if (!person) {
    return NextResponse.json({
      error: "Profile not found in our workforce dataset. Make sure your LinkedIn URL is correct (e.g. linkedin.com/in/your-name).",
    }, { status: 404 });
  }

  // ── 3. Build timeline from person's job history ───────────────────────────
  const rawJobs: any[] = (person.jobs ?? [])
    .filter((j: any) => j.title && j.company?.name)
    .sort((a: any, b: any) =>
      new Date(a.started_at ?? "2000").getTime() - new Date(b.started_at ?? "2000").getTime()
    );

  if (rawJobs.length === 0) {
    return NextResponse.json({
      error: "No career history found for this profile in our dataset.",
    }, { status: 404 });
  }

  const steps: TimelineStep[] = rawJobs.map((j, i) => ({
    id: `job-${i}`,
    startYear: j.started_at ? String(new Date(j.started_at).getFullYear()) : "—",
    endYear:   j.ended_at   ? String(new Date(j.ended_at).getFullYear())   : "Present",
    title:     j.title,
    company:   j.company.name,
    companyType: classifyCompany(j.company.name),
    duration:  j.started_at ? calcDuration(j.started_at, j.ended_at ?? null) : undefined,
    isCurrent: !j.ended_at,
  }));

  // ── 4. Predictions: pathway to dream role (or generic next steps) ─────────
  const currentJob = rawJobs.find(j => !j.ended_at) ?? rawJobs[rawJobs.length - 1];

  if (currentJob?.title) {
    if (dreamRole?.trim()) {
      // ── Path to dream role ────────────────────────────────────────────────
      const dreamKeyword = dreamRole.trim().toLowerCase().split(" ")[0];
      const userKeyword  = currentJob.title.toLowerCase().split(" ")[0];

      // Find people who hold/held the dream role
      const dreamPeople = await ldSearch([{
        operator: "and",
        filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [dreamRole.trim()] }],
      }], 50);

      // Extract intermediate roles between a user-like role and the dream role
      const pathMap: Record<string, { count: number; company: string; companyType: TimelineStep["companyType"] }> = {};

      for (const dp of dreamPeople) {
        const dpJobs: any[] = (dp.jobs ?? []).sort(
          (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
        );
        const dreamIdx = dpJobs.findIndex(j => j.title?.toLowerCase().includes(dreamKeyword));
        if (dreamIdx < 1) continue;

        const beforeDream = dpJobs.slice(0, dreamIdx);
        const similarIdx  = beforeDream.findIndex(j => j.title?.toLowerCase().includes(userKeyword));
        if (similarIdx < 0) continue;

        for (const pj of dpJobs.slice(similarIdx + 1, dreamIdx)) {
          const key = pj.title?.toLowerCase().trim();
          if (!key || key.includes(dreamKeyword)) continue;
          if (!pathMap[key]) {
            pathMap[key] = { count: 0, company: pj.company?.name ?? "Various", companyType: classifyCompany(pj.company?.name ?? "") };
          }
          pathMap[key].count++;
        }
      }

      // Top 1-2 intermediate stepping stones
      const topPath = Object.entries(pathMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 2);

      const nowYear = new Date().getFullYear();
      let yearCursor = nowYear;

      topPath.forEach(([titleKey, data], i) => {
        yearCursor += 2;
        steps.push({
          id: `path-${i}`,
          startYear: String(yearCursor),
          title: titleKey.replace(/\b\w/g, c => c.toUpperCase()),
          company: data.company,
          companyType: data.companyType,
          duration: "~1–3 yrs",
          isPrediction: true,
          predictionBasis: `${data.count} professionals took this step on the way to ${dreamRole}`,
        });
      });

      // Most common company for dream role holders
      const companyCounts: Record<string, number> = {};
      for (const dp of dreamPeople) {
        const curr = (dp.jobs ?? []).find((j: any) => !j.ended_at);
        const name = curr?.company?.name ?? dp.jobs?.[dp.jobs.length - 1]?.company?.name;
        if (name) companyCounts[name] = (companyCounts[name] ?? 0) + 1;
      }
      const topDreamCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Your dream company";

      yearCursor += 2;
      steps.push({
        id: "dream-target",
        startYear: String(yearCursor),
        title: dreamRole.trim(),
        company: topDreamCompany,
        companyType: classifyCompany(topDreamCompany),
        duration: "",
        isTarget: true,
        predictionBasis: `Based on ${dreamPeople.length} professionals currently in this role`,
      } as any);

    } else {
      // ── Generic next-step predictions (no dream role specified) ──────────
      const similar = await ldSearch([{
        operator: "and",
        filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [currentJob.title] }],
      }], 50);

      const keyword = currentJob.title.toLowerCase().split(" ")[0];
      const nextMap: Record<string, { count: number; company: string; companyType: TimelineStep["companyType"] }> = {};

      for (const sp of similar) {
        const spJobs: any[] = (sp.jobs ?? []).sort(
          (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
        );
        for (let i = 0; i < spJobs.length - 1; i++) {
          const curr = spJobs[i];
          const next = spJobs[i + 1];
          if (!curr.title?.toLowerCase().includes(keyword)) continue;
          const key = next.title?.toLowerCase().trim();
          if (!key || key === currentJob.title.toLowerCase().trim()) continue;
          if (!nextMap[key]) {
            nextMap[key] = { count: 0, company: next.company?.name ?? "Various companies", companyType: classifyCompany(next.company?.name ?? "") };
          }
          nextMap[key].count++;
        }
      }

      const topPredictions = Object.entries(nextMap)
        .filter(([, v]) => v.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 2);

      const nowYear = new Date().getFullYear();
      topPredictions.forEach(([titleKey, data], i) => {
        steps.push({
          id: `pred-${i}`,
          startYear: String(nowYear + 1 + i * 2),
          title: titleKey.replace(/\b\w/g, c => c.toUpperCase()),
          company: data.company,
          companyType: data.companyType,
          duration: "~1–3 yrs",
          isPrediction: true,
          predictionBasis: `${data.count} professionals with a similar background made this move`,
        });
      });
    }
  }

  const personName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();

  return NextResponse.json({
    steps,
    personName: personName || undefined,
  });
}
