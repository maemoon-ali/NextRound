import type { UserJobEntry, LiveDataPerson, JobFunction, JobLevel } from "./livedata-types";
import { MOCK_PEOPLE } from "./mock-livedata";

const LEVEL_ORDER: JobLevel[] = ["intern", "entry", "senior", "manager", "director", "vp", "c_suite"];

function levelScore(a: JobLevel | undefined, b: JobLevel): number {
  if (!a) return 0.5;
  const i = LEVEL_ORDER.indexOf(a);
  const j = LEVEL_ORDER.indexOf(b);
  const diff = Math.abs(i - j);
  return Math.max(0, 1 - diff * 0.25);
}

function companyMatch(userCompany: string | undefined, dbCompany: string): number {
  const u = (userCompany ?? "").toString().toLowerCase().trim();
  const d = (dbCompany ?? "").toString().toLowerCase().trim();
  if (u === d) return 1;
  if (d.includes(u) || u.includes(d)) return 0.7;
  return 0;
}

function functionMatch(userFn: JobFunction | undefined, dbFn: JobFunction): number {
  if (!userFn) return 0.6;
  return userFn === dbFn ? 1 : 0.2;
}

/** Tokenize title for similarity (lowercase words, skip very short). */
function titleTokens(s: string | undefined): string[] {
  if (!s || typeof s !== "string") return [];
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Score 0–1: how similar db title is to any of the user's job titles. */
function titleSimilarityScore(userTitles: string[], dbTitle: string | undefined): number {
  if (!dbTitle?.trim() || userTitles.length === 0) return 0;
  const db = titleTokens(dbTitle);
  if (db.length === 0) return 0;
  let best = 0;
  for (const ut of userTitles) {
    const u = titleTokens(ut);
    if (u.length === 0) continue;
    const overlap = u.filter((x) => db.some((y) => y === x || y.includes(x) || x.includes(y))).length;
    const union = new Set([...u, ...db]).size;
    const jaccard = union > 0 ? overlap / union : 0;
    const substring = u.some((x) => dbTitle.toLowerCase().includes(x)) || db.some((d) => ut.toLowerCase().includes(d));
    const score = Math.max(jaccard, substring ? 0.6 : 0);
    if (score > best) best = score;
  }
  return best;
}

/** Normalize location string for comparison (city, region). */
function normalizeLoc(s: string | undefined): { city: string; region: string } {
  if (!s || typeof s !== "string") return { city: "", region: "" };
  const parts = s.split(",").map((p) => p.trim());
  const city = parts[0] ?? "";
  const region = (parts[1] ?? "").toUpperCase();
  return { city, region };
}

/** Score 0–1: how close job location is to user's preferred locations (from job history). */
function locationScore(
  userLocations: { city: string; region: string }[],
  jobLocation: string | undefined,
  jobDetails: { city?: string; region?: string } | undefined
): number {
  if (!userLocations.length) return 0.5;
  if (!jobLocation && !jobDetails?.city) return 0.3;
  const job = jobDetails?.city
    ? { city: (jobDetails.city ?? "").toLowerCase(), region: (jobDetails.region ?? "").toUpperCase() }
    : normalizeLoc(jobLocation);
  for (const u of userLocations) {
    const uc = u.city.toLowerCase();
    const ur = u.region.toUpperCase();
    if (job.city && uc === job.city.toLowerCase() && (!job.region || ur === job.region)) return 1;
    if (job.region && ur === job.region) return 0.75;
    if (job.city && uc === job.city.toLowerCase()) return 0.8;
  }
  return 0.35;
}

/**
 * Score similarity between user job history and a person's job history (LiveDataTechnologies schema).
 * If user provided locations, jobs in the same city/region score higher.
 * If user history has many internships, intern and entry-level roles are boosted.
 */
export function similarityScore(userJobs: UserJobEntry[], person: LiveDataPerson): number {
  const userLocs = [...new Set((userJobs.map((j) => j.location).filter(Boolean) as string[]).map(normalizeLoc))].filter(
    (l) => l.city || l.region
  );
  const internCount = userJobs.filter((j) => (j.role_type ?? "full-time") === "intern").length;
  const userHasInternships = internCount >= 1;
  const mostlyInterns = userJobs.length > 0 && internCount / userJobs.length >= 0.5;

  const pos = person.current_position;
  const userTitles = userJobs.map((j) => (j.title ?? "").trim()).filter(Boolean);
  const titleBoost = titleSimilarityScore(userTitles, pos?.title ?? undefined);

  let total = 0;
  let count = 0;
  const allDbJobs = [...person.job_history, pos];
  for (const u of userJobs) {
    for (const d of allDbJobs) {
      if (!d?.company?.name) continue;
      const company = companyMatch(u.company_name, d.company.name);
      const level = levelScore(u.level ?? "entry", d.level);
      const fn = functionMatch(u.function, d.function);
      const tenureWeight = Math.min(1, Math.abs(u.years_employment - tenureYears(d)) / 5);
      const tenure = 1 - tenureWeight * 0.3;
      const locScore = locationScore(userLocs, d.location, d.location_details);
      let score = company * 0.3 + level * 0.18 + fn * 0.18 + tenure * 0.1 + locScore * 0.12;
      total += score;
      count += 1;
    }
  }
  if (count === 0) return 0;
  let base = total / Math.max(count, 1);
  base = base * 0.85 + titleBoost * 0.15;

  const suggestedLevel = pos?.level ?? "entry";
  const isInternOrEntry = suggestedLevel === "intern" || suggestedLevel === "entry";
  if (isInternOrEntry && (userHasInternships || mostlyInterns)) {
    base = Math.min(1, base + (mostlyInterns ? 0.2 : 0.12));
  }
  return base;
}

function tenureYears(job: { started_at: string; end_date?: string }): number {
  const start = new Date(job.started_at).getTime();
  const end = job.end_date ? new Date(job.end_date).getTime() : Date.now();
  return (end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

export interface MatchResult {
  person: LiveDataPerson;
  score: number;
  suggestedRole: string;
  suggestedFunction: JobFunction;
  suggestedLevel: JobLevel;
  matchReasons?: string[];
}

/** Explain why this role was matched to the user's job history (career pathway). */
export function getMatchReasons(userJobs: UserJobEntry[], person: LiveDataPerson): string[] {
  try {
    const reasons: string[] = [];
    const pos = person?.current_position;
    if (!pos || !pos.company) return ["Matched to your career pathway."];
    const userTitles = userJobs.map((j) => (j.title ?? "").trim()).filter(Boolean);
    const userCompanies = userJobs.map((j) => (j.company_name ?? "").trim()).filter(Boolean);
    const userFns = [...new Set(userJobs.map((j) => j.function).filter(Boolean))] as JobFunction[];
    const userLevels = [...new Set(userJobs.map((j) => j.level).filter(Boolean))] as JobLevel[];
    const avgTenure = userJobs.length
      ? userJobs.reduce((a, j) => a + (j.years_employment ?? 0), 0) / userJobs.length
      : 0;
    const dbTenure = tenureYears(pos);

    if (userFns.length && pos.function && userFns.includes(pos.function)) {
      reasons.push(`Same career function (${String(pos.function).replace("_", " ")})`);
    } else if (pos.function) {
      reasons.push(`Related function: ${String(pos.function).replace("_", " ")}`);
    }
    const companyName = pos.company?.name;
    if (companyName && userCompanies.some((c) => companyMatch(c, companyName) > 0)) {
      reasons.push("Similar or related company profile");
    }
    if (userLevels.length && pos.level && levelScore(userLevels[0], pos.level) >= 0.75) {
      reasons.push(`Aligned seniority (${pos.level})`);
    } else if (pos.level) {
      reasons.push(`Typical next level: ${pos.level}`);
    }
    if (Math.abs(avgTenure - dbTenure) < 2) {
      reasons.push("Similar experience length in role");
    }
    const userLocs = userJobs.map((j) => j.location).filter(Boolean) as string[];
    const jobLoc = pos.location ?? [pos.location_details?.city, pos.location_details?.region].filter(Boolean).join(", ");
    if (userLocs.length && jobLoc && userLocs.some((ul) => normalizeLoc(ul).city === normalizeLoc(jobLoc).city || normalizeLoc(ul).region === normalizeLoc(jobLoc).region)) {
      reasons.push("Location matches your preferred area");
    }
    const title = (pos.title ?? "").toLowerCase();
    if (userTitles.some((t) => t && (title.includes(t.toLowerCase()) || t.toLowerCase().includes(title)))) {
      reasons.push("Title aligns with your background");
    }
    if (reasons.length === 0) reasons.push("Matches your career pathway based on LiveDataTechnologies workforce patterns");
    return reasons.slice(0, 5);
  } catch {
    return ["Matched to your career pathway."];
  }
}

/**
 * Find people with similar job history; return their current roles as suggested next jobs.
 * If `people` is provided (e.g. from live data), uses that pool and dedupes by company+role for variety.
 */
export function findSimilarPeople(
  userJobs: UserJobEntry[],
  topK = 5,
  people?: LiveDataPerson[]
): MatchResult[] {
  if (!Array.isArray(userJobs) || userJobs.length === 0) return [];
  const safe = userJobs.filter((j) => j && (String(j.company_name ?? "").trim() || String(j.title ?? "").trim()));
  if (safe.length === 0) return [];
  const pool = people && people.length > 0 ? people : MOCK_PEOPLE;
  try {
    const withScores = pool
      .map((person) => ({
        person,
        score: similarityScore(safe, person) + Math.random() * 0.008,
      }))
      .filter((x) => x.person?.current_position);
    withScores.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const deduped: typeof withScores = [];
    for (const x of withScores) {
      const key = `${(x.person.current_position.company.name ?? "").toLowerCase()}|${(x.person.current_position.title ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(x);
      if (deduped.length >= topK) break;
    }
    return deduped.map(({ person, score }) => {
      const pos = person?.current_position;
      return {
        person,
        score,
        suggestedRole: pos?.title ?? "Role",
        suggestedFunction: pos?.function ?? "engineering",
        suggestedLevel: pos?.level ?? "entry",
        matchReasons: getMatchReasons(safe, person),
      };
    });
  } catch {
    return [];
  }
}
