/**
 * LiveData Technologies API client.
 * All workforce data comes from the LiveData API — no local JSON file.
 * Server-side only (API routes).
 */

// Hard guard: crash at module load if somehow imported in a browser/edge context.
if (typeof window !== "undefined") {
  throw new Error("livedata-api must only be used server-side. Never import it in client components.");
}

import type { LiveDataPerson, LiveDataJob, JobLevel, JobFunction, Company } from "./livedata-types";

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

const API_BASE = `${process.env.LIVEDATA_API_URL ?? "https://gotlivedata.io/api/people/v1"}/${process.env.LIVEDATA_ORG_ID}`;
const API_KEY = process.env.LIVEDATA_API_KEY ?? "";

// ─── Level mappings ────────────────────────────────────────────────────────────

const API_TO_APP_LEVEL: Record<string, JobLevel> = {
  "intern": "intern",
  "entry level": "entry",
  "staff": "entry",
  "senior staff": "senior",
  "manager": "manager",
  "senior manager/manager": "manager",
  "director": "director",
  "vp": "vp",
  "c-team": "c_suite",
  "c_suite": "c_suite",
};

const APP_TO_API_LEVEL: Record<string, string> = {
  intern: "Intern",
  entry: "Entry Level",
  senior: "Senior Staff",
  manager: "Manager",
  director: "Director",
  vp: "VP",
  c_suite: "C-Team",
};

// ─── Function mappings ─────────────────────────────────────────────────────────

const API_TO_APP_FUNCTION: Record<string, JobFunction> = {
  "engineering": "engineering",
  "information technology": "engineering",
  "marketing and product": "marketing",
  "sales and support": "sales",
  "finance and administration": "finance",
  "human resources": "operations",
  "business management": "operations",
  "design": "design",
  "data science": "data_science",
  "customer success": "customer_success",
  "operations": "operations",
  "legal": "operations",
  "research": "data_science",
  "medical and clinical": "operations",
};

const APP_TO_API_FUNCTION: Record<string, string> = {
  engineering: "Engineering",
  product: "Marketing and Product",
  design: "Design",
  sales: "Sales and Support",
  marketing: "Marketing and Product",
  operations: "Business Management",
  finance: "Finance and Administration",
  data_science: "Data Science",
  customer_success: "Customer Success",
};

function mapApiLevel(level: string | null | undefined): JobLevel {
  if (!level) return "entry";
  return API_TO_APP_LEVEL[level.toLowerCase()] ?? "entry";
}

function mapApiFunction(fn: string | null | undefined): JobFunction {
  if (!fn) return "engineering";
  return API_TO_APP_FUNCTION[fn.toLowerCase()] ?? "engineering";
}

export function toApiFunction(fn: JobFunction | string | undefined): string | null {
  if (!fn) return null;
  return APP_TO_API_FUNCTION[String(fn).toLowerCase()] ?? null;
}

export function toApiLevel(level: JobLevel | string | undefined): string | null {
  if (!level) return null;
  return APP_TO_API_LEVEL[String(level).toLowerCase()] ?? null;
}

// ─── Raw API types ─────────────────────────────────────────────────────────────

interface ApiCompany {
  id?: string;
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  country?: string | null;
  location?: string | null;
}

interface ApiJob {
  title?: string | null;
  level?: string | null;
  function?: string | null;
  location?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  company?: ApiCompany | null;
}

interface ApiPerson {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  linkedin?: string | null;
  location?: string | null;
  employment_status?: string | null;
  position?: ApiJob | null;
  jobs?: ApiJob[] | null;
}

interface ApiSearchResponse {
  people?: ApiPerson[];
  count?: number;
  pagination_token?: string;
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapApiCompany(c: ApiCompany | null | undefined): Company {
  return {
    name: c?.name ?? "Unknown",
    domain: c?.domain ?? undefined,
    industry: c?.industry ?? undefined,
    employee_count: typeof c?.employee_count === "number" ? c.employee_count : undefined,
    country: c?.country ?? undefined,
  };
}

function mapApiJob(j: ApiJob | null | undefined): LiveDataJob | null {
  if (!j?.title || !j?.company?.name) return null;
  return {
    title: j.title.trim(),
    level: mapApiLevel(j.level),
    function: mapApiFunction(j.function),
    company: mapApiCompany(j.company),
    location: j.location ?? undefined,
    started_at: j.started_at ?? "2020-01-01T00:00:00Z",
    end_date: j.ended_at ?? undefined,
  };
}

export function mapApiPerson(p: ApiPerson): LiveDataPerson | null {
  const current = mapApiJob(p.position);
  if (!current) return null;

  const history = (p.jobs ?? [])
    .map(mapApiJob)
    .filter((j): j is LiveDataJob => j !== null && j.title !== current.title);

  const seen = new Set<string>();
  const deduped = history.filter((j) => {
    const key = `${j.company.name}|${j.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    id: p.id,
    display_name: p.name ?? undefined,
    linkedin_url: p.linkedin ? `https://www.linkedin.com/in/${p.linkedin}` : undefined,
    current_position: current,
    job_history: deduped.slice(0, 20),
  };
}

// ─── Search filter type ────────────────────────────────────────────────────────

export interface LdtFilter {
  operator?: string;
  filters?: LdtFilter[];
  field?: string;
  type?: string;
  match_type?: string;
  string_values?: string[];
  date_from?: string;
  date_to?: string;
  // Job-group fields required by LiveData API for job-specific filters
  isJobsGroup?: boolean;
  jobsGroupType?: "active" | "ended" | "any";
  positionStatus?: "all" | "first" | "last" | "promotion";
}

// ─── Core API call ─────────────────────────────────────────────────────────────

async function callSearchApi(body: object): Promise<{ people: ApiPerson[]; count: number }> {
  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`LiveData API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as ApiSearchResponse;
  return { people: data.people ?? [], count: data.count ?? 0 };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Search people with filters, return mapped LiveDataPerson[]. */
export async function searchPeople(filters: LdtFilter[], size = 100): Promise<LiveDataPerson[]> {
  const body = filters.length > 0 ? { filters, size } : { size };
  const { people } = await callSearchApi(body);
  return people.map(mapApiPerson).filter(Boolean) as LiveDataPerson[];
}

/** Get company metadata by fetching people at that company from LiveData. */
export async function getCompanyMetaFromApi(
  companyName: string,
  opts?: { function?: string; level?: string }
): Promise<CompanyMeta | null> {
  const companyFilter: LdtFilter = {
    operator: "and",
    filters: [
      { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [companyName] },
    ],
  };

  const { people: basePeople, count: baseCount } = await callSearchApi({
    filters: [companyFilter],
    size: 20,
  });

  if (!basePeople.length) return null;

  const normTarget = companyName.toLowerCase();
  let domain: string | undefined;
  let industry: string | undefined;
  let employee_count: number | undefined;
  const countries = new Set<string>();
  const titleCountsAll = new Map<string, number>();

  for (const p of basePeople) {
    const allJobs = [...(p.jobs ?? []), ...(p.position ? [p.position] : [])];
    for (const j of allJobs) {
      if (!j.company?.name) continue;
      const jName = j.company.name.toLowerCase();
      if (jName !== normTarget && !jName.includes(normTarget) && !normTarget.includes(jName)) continue;
      if (!domain && j.company.domain) domain = j.company.domain;
      if (!industry && j.company.industry) industry = j.company.industry;
      if (employee_count == null && j.company.employee_count) employee_count = j.company.employee_count;
      if (j.company.country) countries.add(j.company.country);
      const t = (j.title ?? "").trim();
      if (t) titleCountsAll.set(t, (titleCountsAll.get(t) ?? 0) + 1);
    }
  }

  let filteredCount = baseCount;
  const titleCountsFiltered = new Map<string, number>();

  if (opts?.function || opts?.level) {
    const subFilters: LdtFilter[] = [
      { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [companyName] },
    ];
    const apiFunction = opts.function ? toApiFunction(opts.function) : null;
    if (apiFunction) {
      subFilters.push({ field: "jobs.function", type: "must", match_type: "exact", string_values: [apiFunction] });
    }
    const apiLevel = opts.level ? toApiLevel(opts.level) : null;
    if (apiLevel) {
      subFilters.push({ field: "jobs.level", type: "must", match_type: "exact", string_values: [apiLevel] });
    }

    const { people: filteredPeople, count: fc } = await callSearchApi({
      filters: [{ operator: "and", filters: subFilters }],
      size: 20,
    });
    filteredCount = fc;

    for (const p of filteredPeople) {
      const allJobs = [...(p.jobs ?? []), ...(p.position ? [p.position] : [])];
      for (const j of allJobs) {
        if (!j.company?.name) continue;
        const jName = j.company.name.toLowerCase();
        if (jName !== normTarget && !jName.includes(normTarget) && !normTarget.includes(jName)) continue;
        const t = (j.title ?? "").trim();
        if (t) titleCountsFiltered.set(t, (titleCountsFiltered.get(t) ?? 0) + 1);
      }
    }
  }

  return {
    name: companyName,
    domain,
    industry,
    employee_count,
    countries: Array.from(countries).filter(Boolean).slice(0, 8),
    profiles_in_dataset: baseCount,
    roles_at_company: baseCount,
    roles_matching_filters: filteredCount,
    top_titles: Array.from(titleCountsAll.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title, count]) => ({ title, count })),
    top_titles_matching_filters: Array.from(titleCountsFiltered.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title, count]) => ({ title, count })),
  };
}

/** Get people who worked at a company from LiveData.
 *  When `school` is provided, first tries to surface people who attended
 *  that school AND worked at the company. Remaining slots are filled from
 *  company-only results (deduped). */
export async function getPeopleAtCompany(
  companyName: string,
  opts?: { function?: string; level?: string; limit?: number; school?: string }
): Promise<LiveDataPerson[]> {
  const limit = opts?.limit ?? 2;
  const subFilters: LdtFilter[] = [
    { field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [companyName] },
  ];

  const apiFunction = opts?.function ? toApiFunction(opts.function) : null;
  if (apiFunction) {
    subFilters.push({ field: "jobs.function", type: "must", match_type: "exact", string_values: [apiFunction] });
  }
  const apiLevel = opts?.level ? toApiLevel(opts.level) : null;
  if (apiLevel) {
    subFilters.push({ field: "jobs.level", type: "must", match_type: "exact", string_values: [apiLevel] });
  }

  const school = opts?.school?.trim();
  let schoolMatches: LiveDataPerson[] = [];

  // ── Stage 1: School + company (if school provided) ─────────────────────────
  if (school) {
    try {
      const schoolFilters: LdtFilter[] = [
        ...subFilters,
        { field: "education.school", type: "must", match_type: "fuzzy", string_values: [school], isJobsGroup: false },
      ];
      const { people: schoolPeople } = await callSearchApi({
        filters: [{ operator: "and", filters: schoolFilters }],
        size: limit,
      });
      schoolMatches = schoolPeople.map(mapApiPerson).filter(Boolean) as LiveDataPerson[];
    } catch {
      // Education filter not supported or no results — fall through to stage 2
      schoolMatches = [];
    }
    if (schoolMatches.length >= limit) return schoolMatches.slice(0, limit);
  }

  // ── Stage 2: Company-only fill ─────────────────────────────────────────────
  const remaining = limit - schoolMatches.length;
  const { people } = await callSearchApi({
    filters: [{ operator: "and", filters: subFilters }],
    size: limit + remaining * 2, // fetch extra to cover deduplication
  });
  const companyMapped = people.map(mapApiPerson).filter(Boolean) as LiveDataPerson[];
  const usedIds = new Set(schoolMatches.map((p) => p.id));
  const fillPeople = companyMapped.filter((p) => !usedIds.has(p.id)).slice(0, remaining);

  return [...schoolMatches, ...fillPeople];
}
