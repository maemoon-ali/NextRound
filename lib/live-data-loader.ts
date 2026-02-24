/**
 * Load workforce data from live_data_persons_history_combined.json.
 * Used server-side only (API route). Maps JSON schema to LiveDataPerson[].
 */

import type { LiveDataPerson, LiveDataJob, JobLevel, JobFunction, Company, LocationDetails } from "./livedata-types";
import path from "path";
import fs from "fs";

const LEVEL_MAP: Record<string, JobLevel> = {
  intern: "intern",
  entry: "entry",
  staff: "entry",
  senior: "senior",
  manager: "manager",
  director: "director",
  vp: "vp",
  "c_suite": "c_suite",
  "c-suite": "c_suite",
};

const FUNCTION_MAP: Record<string, JobFunction> = {
  engineering: "engineering",
  product: "product",
  design: "design",
  sales: "sales",
  marketing: "marketing",
  operations: "operations",
  finance: "finance",
  "data_science": "data_science",
  "data science": "data_science",
  customer_success: "customer_success",
  "customer success": "customer_success",
  "business management": "operations",
};

function normalizeLevel(s: string | null | undefined): JobLevel {
  if (!s) return "entry";
  const key = String(s).toLowerCase().replace(/\s+/g, "_");
  return LEVEL_MAP[key] ?? "entry";
}

function normalizeFunction(s: string | null | undefined): JobFunction {
  if (!s) return "engineering";
  const key = String(s).toLowerCase().replace(/\s+/g, " ");
  return FUNCTION_MAP[key] ?? "engineering";
}

interface JsonCompany {
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  country?: string | null;
}

interface JsonLocationDetails {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  locality?: string | null;
  raw?: string | null;
}

interface JsonJob {
  title?: string | null;
  level?: string | null;
  function?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  location?: string | null;
  company?: JsonCompany | null;
  location_details?: JsonLocationDetails | null;
}

interface JsonPerson {
  id: string;
  position?: JsonJob | null;
  jobs?: JsonJob[] | null;
}

function mapCompany(c: JsonCompany | null | undefined): Company {
  if (!c?.name) return { name: "Unknown" };
  return {
    name: String(c.name),
    domain: c.domain ? String(c.domain) : undefined,
    industry: c.industry ? String(c.industry) : undefined,
    employee_count: typeof c.employee_count === "number" ? c.employee_count : undefined,
    country: c.country ? String(c.country) : undefined,
  };
}

function mapLocationDetails(l: JsonLocationDetails | null | undefined): LocationDetails | undefined {
  if (!l) return undefined;
  return {
    city: (l.city ?? l.locality) ? String(l.city ?? l.locality) : undefined,
    region: l.region ? String(l.region) : undefined,
    country: l.country ? String(l.country) : undefined,
  };
}

function mapJob(j: JsonJob | null | undefined): LiveDataJob | null {
  if (!j?.company?.name || j.company.name === "None") return null;
  const title = j.title?.trim();
  if (!title) return null;
  return {
    title,
    level: normalizeLevel(j.level),
    function: normalizeFunction(j.function),
    company: mapCompany(j.company),
    location: j.location ? String(j.location) : undefined,
    location_details: mapLocationDetails(j.location_details),
    started_at: j.started_at ? String(j.started_at) : "2020-01-01T00:00:00Z",
    end_date: j.ended_at ? String(j.ended_at) : undefined,
  };
}

let cachedPeople: LiveDataPerson[] | null = null;

function normName(s: string): string {
  return s.trim().toLowerCase();
}

export type CompanyMeta = {
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  countries: string[];
  profiles_in_dataset: number;
  roles_at_company: number;
  roles_matching_filters: number;
  top_titles: { title: string; count: number }[];
  top_titles_matching_filters: { title: string; count: number }[];
};

/**
 * Load and parse live_data_persons_history_combined.json. Cached after first load.
 * Call from API route only (uses fs).
 */
export function loadLiveData(): LiveDataPerson[] {
  if (cachedPeople) return cachedPeople;
  const filePath = path.join(process.cwd(), "live_data_persons_history_combined.json");
  if (!fs.existsSync(filePath)) return [];

  // The dataset can be very large (hundreds of MB). Avoid JSON.parse() on the full file.
  // The file format is a JSON array where each person object is typically on its own line:
  // [
  //   {...},
  //   {...},
  //   ...
  // ]
  // We stream it synchronously and parse one object per line to keep memory bounded.
  const result: LiveDataPerson[] = [];
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(1024 * 1024);
  let leftover = "";
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
      if (bytesRead <= 0) break;
      const chunk = buf.subarray(0, bytesRead).toString("utf8");
      const combined = leftover + chunk;
      const lines = combined.split("\n");
      leftover = lines.pop() ?? "";
      for (const lineRaw of lines) {
        const line = lineRaw.trim().replace(/\r$/, "");
        if (!line || line === "[" || line === "]") continue;
        if (!line.startsWith("{")) continue;
        const jsonLine = line.endsWith(",") ? line.slice(0, -1) : line;
        let item: JsonPerson;
        try {
          item = JSON.parse(jsonLine) as JsonPerson;
        } catch {
          continue;
        }
        const current = mapJob(item.position);
        if (!current) continue;
        const history = (item.jobs ?? [])
          .map(mapJob)
          .filter((j): j is LiveDataJob => j !== null && j.title !== current.title);
        const seen = new Set<string>();
        const deduped = history.filter((j) => {
          const key = `${j.company.name}|${j.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        result.push({
          id: item.id,
          current_position: current,
          job_history: deduped.slice(0, 20),
        });
      }
    }
    // Process any remaining partial line (e.g. last object line)
    const last = leftover.trim().replace(/\r$/, "");
    if (last.startsWith("{")) {
      const jsonLine = last.endsWith(",") ? last.slice(0, -1) : last;
      try {
        const item = JSON.parse(jsonLine) as JsonPerson;
        const current = mapJob(item.position);
        if (current) {
          const history = (item.jobs ?? [])
            .map(mapJob)
            .filter((j): j is LiveDataJob => j !== null && j.title !== current.title);
          const seen = new Set<string>();
          const deduped = history.filter((j) => {
            const key = `${j.company.name}|${j.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          result.push({
            id: item.id,
            current_position: current,
            job_history: deduped.slice(0, 20),
          });
        }
      } catch {
        // ignore
      }
    }
  } finally {
    try { fs.closeSync(fd); } catch { /* ignore */ }
  }
  cachedPeople = result;
  return result;
}

export function getCompanyMetaFromLiveData(
  companyName: string,
  opts?: { function?: string; level?: string }
): CompanyMeta | null {
  const people = loadLiveData();
  if (!people.length) return null;
  const target = normName(companyName);
  const fn = opts?.function ? String(opts.function).trim().toLowerCase() : "";
  const lev = opts?.level ? String(opts.level).trim().toLowerCase() : "";

  let domain: string | undefined;
  let industry: string | undefined;
  let employee_count: number | undefined;
  const countries = new Set<string>();
  let profiles = 0;
  let rolesAtCompany = 0;
  let rolesMatching = 0;
  const titleCountsAll = new Map<string, number>();
  const titleCountsFiltered = new Map<string, number>();

  for (const p of people) {
    const jobs = [...(p.job_history ?? []), p.current_position].filter(Boolean);
    let personCounted = false;
    for (const j of jobs) {
      if (normName(j.company.name) !== target) continue;
      rolesAtCompany++;
      if (!personCounted) {
        profiles++;
        personCounted = true;
      }
      if (!domain && j.company.domain) domain = j.company.domain;
      if (!industry && j.company.industry) industry = j.company.industry;
      if (employee_count == null && typeof j.company.employee_count === "number") employee_count = j.company.employee_count;
      if (j.company.country) countries.add(j.company.country);
      if (j.location_details?.country) countries.add(j.location_details.country);
      const fnOk = !fn || String(j.function ?? "").toLowerCase() === fn;
      const levOk = !lev || String(j.level ?? "").toLowerCase() === lev;
      const titleKey = (j.title ?? "").trim();
      if (titleKey) titleCountsAll.set(titleKey, (titleCountsAll.get(titleKey) ?? 0) + 1);
      if (fnOk && levOk) {
        rolesMatching++;
        if (titleKey) titleCountsFiltered.set(titleKey, (titleCountsFiltered.get(titleKey) ?? 0) + 1);
      }
    }
  }

  if (profiles === 0) return null;

  const top_titles = Array.from(titleCountsAll.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([title, count]) => ({ title, count }));
  const top_titles_matching_filters = Array.from(titleCountsFiltered.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([title, count]) => ({ title, count }));

  return {
    name: companyName,
    domain,
    industry,
    employee_count,
    countries: Array.from(countries).filter(Boolean).slice(0, 8),
    profiles_in_dataset: profiles,
    roles_at_company: rolesAtCompany,
    roles_matching_filters: rolesMatching,
    top_titles,
    top_titles_matching_filters,
  };
}
