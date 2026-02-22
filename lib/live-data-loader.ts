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

/**
 * Load and parse live_data_persons_history_combined.json. Cached after first load.
 * Call from API route only (uses fs).
 */
export function loadLiveData(): LiveDataPerson[] {
  if (cachedPeople) return cachedPeople;
  const filePath = path.join(process.cwd(), "live_data_persons_history_combined.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  let json: JsonPerson[];
  try {
    json = JSON.parse(raw) as JsonPerson[];
  } catch {
    return [];
  }
  const result: LiveDataPerson[] = [];
  for (const item of json) {
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
  cachedPeople = result;
  return result;
}
