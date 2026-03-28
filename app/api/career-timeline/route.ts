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
  let body: { linkedinUrl?: string; dreamRole?: string; dreamCompany?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { linkedinUrl, dreamRole, dreamCompany } = body;
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
      const dreamNorm  = dreamRole.trim().toLowerCase();
      const dreamWords = dreamNorm.split(/\s+/).filter(w => w.length > 2);
      const titleMatch = (t: string) => dreamWords.length > 1
        ? dreamWords.every(w => t.toLowerCase().includes(w))
        : t.toLowerCase().includes(dreamWords[0] ?? dreamNorm);

      // Company similarity helper
      const companyMatch = (a: string, b: string): boolean => {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        const na = norm(a), nb = norm(b);
        if (na === nb || na.includes(nb) || nb.includes(na)) return true;
        const stop = new Set(["the","and","for","inc","llc","corp","pvt","ltd","pte","gmbh","co","of"]);
        const sig = (s: string) => s.split(" ").filter(w => w.length > 3 && !stop.has(w));
        const wa = sig(na), wb = sig(nb);
        const ref = wb.length <= wa.length ? wb : wa;
        if (ref.length === 0) return na.includes(nb.split(" ")[0] ?? nb);
        const hits = ref.filter(w => (wb.length <= wa.length ? wa : wb).includes(w));
        return hits.length >= Math.ceil(ref.length / 2);
      };

      // Build filters: always target the role, and add company filter if dreamCompany is given
      const searchFilters: object[] = dreamCompany?.trim()
        ? [{
            operator: "and",
            filters: [
              { field: "jobs.title",        type: "must", match_type: "fuzzy", string_values: [dreamRole.trim()] },
              { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [dreamCompany.trim()] },
            ],
          }]
        : [{
            operator: "and",
            filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [dreamRole.trim()] }],
          }];

      // Find people who hold/held the dream role (at the dream company if specified)
      let dreamPeople = await ldSearch(searchFilters, 100);

      // If the company-filtered search returned too few, fall back to role-only search
      if (dreamCompany?.trim() && dreamPeople.length < 5) {
        const fallback = await ldSearch([{
          operator: "and",
          filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [dreamRole.trim()] }],
        }], 100);
        dreamPeople = fallback;
      }

      // When dreamCompany is set, only study paths from people who actually held the role at that company
      const relevantDreamPeople = dreamCompany?.trim()
        ? dreamPeople.filter(dp =>
            (dp.jobs ?? []).some((j: any) =>
              titleMatch(j.title ?? "") && companyMatch(j.company?.name ?? "", dreamCompany.trim())
            )
          )
        : dreamPeople;

      // Use company-matched people if we have enough; otherwise use full set
      const pathSource = relevantDreamPeople.length >= 5 ? relevantDreamPeople : dreamPeople;

      // Extract roles that commonly precede the dream role.
      // Split into two pools:
      //   internalMap — stepping-stone was at the dream company itself (internal move)
      //   externalMap — stepping-stone was at a different company (feeder path)
      type PathEntry = {
        count: number;
        company: string;
        companyType: TimelineStep["companyType"];
        companyCounts: Record<string, number>;
      };
      const internalMap: Record<string, PathEntry> = {};
      const externalMap: Record<string, PathEntry> = {};

      for (const dp of pathSource) {
        const dpJobs: any[] = (dp.jobs ?? []).sort(
          (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
        );
        const dreamIdx = dpJobs.findIndex(j => titleMatch(j.title ?? ""));
        if (dreamIdx < 1) continue;

        // Record 1-2 roles that appear immediately before the dream role
        const prevRoles = dpJobs.slice(Math.max(0, dreamIdx - 2), dreamIdx);
        for (const pj of prevRoles) {
          const key = pj.title?.toLowerCase().trim();
          if (!key || titleMatch(key)) continue;

          const coName = pj.company?.name ?? "";
          const isInternal = dreamCompany?.trim()
            ? companyMatch(coName, dreamCompany.trim())
            : false;
          const map = isInternal ? internalMap : externalMap;

          if (!map[key]) {
            map[key] = {
              count: 0,
              company: coName || "Various",
              companyType: classifyCompany(coName),
              companyCounts: {},
            };
          }
          map[key].count++;
          if (coName) {
            map[key].companyCounts[coName] = (map[key].companyCounts[coName] ?? 0) + 1;
          }
        }
      }

      // Pick best internal (same company) and best external (feeder) stepping stone.
      // Result: up to 1 internal + 1 external, ensuring company diversity.
      const bestInternal = Object.entries(internalMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 1);
      const bestExternal = Object.entries(externalMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 1);

      // Assemble: show external first (broader feeder), then internal (same-company promotion)
      // If no dreamCompany was given, just take top 2 from external
      const topPath: [string, PathEntry][] = dreamCompany?.trim()
        ? [...bestExternal, ...bestInternal]
        : Object.entries(externalMap).sort((a, b) => b[1].count - a[1].count).slice(0, 2);

      const nowYear = new Date().getFullYear();
      let yearCursor = nowYear;

      if (topPath.length === 0) {
        // No intermediate roles found — show explicit "no path" card
        yearCursor += 2;
        steps.push({
          id: "path-no-data",
          startYear: String(yearCursor),
          title: "No direct stepping-stone found",
          company: `Our dataset found ${dreamPeople.length} ${dreamRole} holders but no common intermediate role for your path`,
          companyType: "any",
          duration: "",
          isPrediction: true,
          predictionBasis: `Try lateral moves or upskilling toward ${dreamRole}`,
          transitionCount: 0,
          alternativeCompanies: [],
        } as any);
        yearCursor += 2;
      } else {
        topPath.forEach(([titleKey, data], i) => {
          yearCursor += 2;
          const altCompanies = Object.entries(data.companyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name)
            .filter(name => name !== data.company);

          steps.push({
            id: `path-${i}`,
            startYear: String(yearCursor),
            title: titleKey.replace(/\b\w/g, c => c.toUpperCase()),
            company: data.company,
            companyType: data.companyType,
            duration: "~1–3 yrs",
            isPrediction: true,
            predictionBasis: `${data.count} professionals took this step`,
            transitionCount: data.count,
            alternativeCompanies: altCompanies,
          } as any);
        });
        yearCursor += 2;
      }

      // Determine company for dream role node + top companies for alt display
      const dreamCompanyCounts: Record<string, number> = {};
      for (const dp of pathSource) {
        const curr = (dp.jobs ?? []).find((j: any) => !j.ended_at);
        const name = curr?.company?.name ?? dp.jobs?.[dp.jobs.length - 1]?.company?.name;
        if (name) dreamCompanyCounts[name] = (dreamCompanyCounts[name] ?? 0) + 1;
      }
      const topDreamCompanies = Object.entries(dreamCompanyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name]) => name);

      let targetCompany = dreamCompany?.trim() || "";
      if (!targetCompany) {
        targetCompany = topDreamCompanies[0] ?? "Your dream company";
      }
      const altDreamCompanies = topDreamCompanies.filter(c => c !== targetCompany).slice(0, 4);

      steps.push({
        id: "dream-target",
        startYear: String(yearCursor),
        title: dreamRole.trim(),
        company: targetCompany,
        companyType: classifyCompany(targetCompany),
        duration: "",
        isTarget: true,
        predictionBasis: `Est. ${yearCursor - nowYear} yr${yearCursor - nowYear !== 1 ? "s" : ""} from today based on real career transitions`,
        transitionCount: pathSource.length,
        alternativeCompanies: altDreamCompanies,
      } as any);

    } else {
      // ── Generic next-step predictions (no dream role specified) ──────────
      const similar = await ldSearch([{
        operator: "and",
        filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [currentJob.title] }],
      }], 50);

      const currNorm  = currentJob.title.trim().toLowerCase();
      const currWords = currNorm.split(/\s+/).filter((w: string) => w.length > 2);
      const currMatch = (t: string) => currWords.length > 1
        ? currWords.every((w: string) => t.toLowerCase().includes(w))
        : t.toLowerCase().includes(currWords[0] ?? currNorm);
      const nextMap: Record<string, { count: number; company: string; companyType: TimelineStep["companyType"] }> = {};

      for (const sp of similar) {
        const spJobs: any[] = (sp.jobs ?? []).sort(
          (a: any, b: any) => new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
        );
        for (let i = 0; i < spJobs.length - 1; i++) {
          const curr = spJobs[i];
          const next = spJobs[i + 1];
          if (!currMatch(curr.title ?? "")) continue;
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
