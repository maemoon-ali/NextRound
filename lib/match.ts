import type { UserJobEntry, UserEducationEntry, LiveDataPerson, JobFunction, JobLevel } from "./livedata-types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_ORDER: JobLevel[] = ["intern", "entry", "senior", "manager", "director", "vp", "c_suite"];

const STOP_WORDS = new Set(["a", "an", "the", "of", "in", "at", "for", "to", "and", "or", "with", "on", "as", "by", "is", "be", "are", "was"]);

const TITLE_SYNONYMS: Record<string, string> = {
  "swe": "engineer", "dev": "developer", "pm": "product manager",
  "product management": "product manager", "ml": "machine learning",
  "ds": "data scientist", "data science": "data scientist",
  "ux": "user experience", "ui": "user interface",
  "hr": "human resources", "vp": "vice president",
  "cto": "chief technology officer", "ceo": "chief executive officer",
  "cfo": "chief financial officer", "coo": "chief operating officer",
};

/** Expected salary band [min, max] per level (annual USD) */
const LEVEL_SALARY_BAND: Record<string, [number, number]> = {
  intern:   [0,       65_000],
  entry:    [45_000,  95_000],
  senior:   [85_000,  160_000],
  manager:  [110_000, 190_000],
  director: [150_000, 270_000],
  vp:       [200_000, 380_000],
  c_suite:  [260_000, 700_000],
};

const KEY_TITLE_WORDS = [
  "engineer", "manager", "director", "analyst", "developer", "designer",
  "scientist", "executive", "officer", "lead", "head", "principal",
  "architect", "consultant", "specialist", "coordinator", "associate",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function levelOrdinal(l: JobLevel | string | undefined): number {
  const i = LEVEL_ORDER.indexOf(l as JobLevel);
  return i >= 0 ? i : 1; // default to "entry"
}

function avgLevelOrd(levels: (JobLevel | string | undefined)[]): number {
  const vals = levels.map(levelOrdinal);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
}

function tenureYears(job: { started_at?: string; end_date?: string }): number {
  const start = new Date(job.started_at ?? "2020-01-01").getTime();
  const end = job.end_date ? new Date(job.end_date).getTime() : Date.now();
  return Math.max(0, (end - start) / (365.25 * 24 * 60 * 60 * 1000));
}

function parseYear(dateStr?: string): number {
  if (!dateStr) return new Date().getFullYear();
  return new Date(dateStr).getFullYear();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Title Matching  (28% current + 18% history = 46% combined)
// ─────────────────────────────────────────────────────────────────────────────

function titleTokens(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function normalisedTokens(s: string): string[] {
  return titleTokens(s).map((t) => TITLE_SYNONYMS[t] ?? t).flatMap((t) => t.split(" "));
}

function titleSimilarity(a: string, b: string): number {
  const aTok = normalisedTokens(a);
  const bTok = normalisedTokens(b);
  if (!aTok.length || !bTok.length) return 0;

  // Jaccard with prefix/suffix matching
  const bSet = new Set(bTok);
  let overlap = 0;
  for (const t of aTok) {
    if (bSet.has(t) || [...bSet].some((bt) => t.startsWith(bt) || bt.startsWith(t))) overlap++;
  }
  const jaccard = overlap / new Set([...aTok, ...bTok]).size;

  // Substring bonus: one title fully contained in the other
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  const subBonus = aLow.includes(bLow) || bLow.includes(aLow) ? 0.28 : 0;

  // Key-word match bonus (both share a senior/structural role word)
  const aKey = aTok.filter((t) => KEY_TITLE_WORDS.some((k) => t.includes(k) || k.includes(t)));
  const bKey = bTok.filter((t) => KEY_TITLE_WORDS.some((k) => t.includes(k) || k.includes(t)));
  const keyBonus =
    aKey.length && bKey.length && aKey.some((k) => bKey.some((bk) => k === bk || k.includes(bk) || bk.includes(k)))
      ? 0.15
      : 0;

  return Math.min(1, jaccard + subBonus + keyBonus);
}

function bestTitleSimilarity(userTitles: string[], compareTitles: string[]): number {
  if (!userTitles.length || !compareTitles.length) return 0;
  let best = 0;
  for (const u of userTitles) {
    for (const c of compareTitles) {
      const s = titleSimilarity(u, c);
      if (s > best) best = s;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Experience Level Fit  (14%)
// ─────────────────────────────────────────────────────────────────────────────

function experienceLevelScore(userAvgLevel: number, personLevel: number): number {
  const gap = personLevel - userAvgLevel;
  if (gap < 0)  return 0.85; // slightly below user's level — still fine
  if (gap === 0) return 1.00; // perfect match
  if (gap <= 1) return 0.88; // one step up — natural next step
  if (gap <= 2) return 0.55; // two steps — stretch
  return 0.18;               // too far ahead
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Role Type Alignment  (10%)
// ─────────────────────────────────────────────────────────────────────────────

const FULL_TIME_LIKE  = new Set(["full-time", "fulltime", "permanent", "full time"]);
const FLEXIBLE        = new Set(["contract", "freelance", "part-time", "parttime", "consultant", "part time"]);
const TRAINING        = new Set(["intern", "internship", "trainee", "apprentice"]);

function normRT(s: string): string { return s.toLowerCase().replace(/[_\s]/g, "-"); }

function roleTypeScore(userRoleTypes: string[], personRoleType: string | undefined): number {
  if (!personRoleType || !userRoleTypes.length) return 0.5;
  const pRT = normRT(personRoleType);
  for (const urt of userRoleTypes) {
    const uRT = normRT(urt);
    if (uRT === pRT) return 1.0;
    // Same category
    if (FULL_TIME_LIKE.has(uRT) && FULL_TIME_LIKE.has(pRT)) return 1.0;
    if (FLEXIBLE.has(uRT) && FLEXIBLE.has(pRT)) return 0.85;
    if (TRAINING.has(uRT) && TRAINING.has(pRT)) return 1.0;
    // Natural progressions
    if (TRAINING.has(uRT) && FULL_TIME_LIKE.has(pRT)) return 0.80; // intern → full-time
    if (FULL_TIME_LIKE.has(uRT) && FLEXIBLE.has(pRT)) return 0.50;
  }
  return 0.30;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Salary Band Alignment  (9%)
// ─────────────────────────────────────────────────────────────────────────────

function salaryBandScore(userJobs: UserJobEntry[], personLevel: string | undefined): number {
  const sals = userJobs.map((j) => j.salary ?? 0).filter((s) => s > 0);
  if (!sals.length) return 0.5;
  const avgSal = sals.reduce((a, b) => a + b, 0) / sals.length;
  const level = (personLevel ?? "entry").toLowerCase();
  const [bandMin, bandMax] = LEVEL_SALARY_BAND[level] ?? [50_000, 150_000];
  // Within band (with ±20% tolerance) → perfect
  if (avgSal >= bandMin * 0.80 && avgSal <= bandMax * 1.20) return 1.0;
  // Below band — role may be a promotion target
  if (avgSal < bandMin) {
    const dist = (bandMin - avgSal) / Math.max(bandMin, 1);
    return Math.max(0.30, 1 - dist * 0.8);
  }
  // Above band — over-qualified for this level
  const dist = (avgSal - bandMax) / Math.max(bandMax, 1);
  return Math.max(0.20, 1 - dist * 1.2);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Career Timing & Recency  (8%)
// ─────────────────────────────────────────────────────────────────────────────

function careerTimingScore(
  userJobs: UserJobEntry[],
  person: LiveDataPerson,
  userStartYears: number[],
): number {
  const pastJobs = person.job_history;
  const currentYear = new Date().getFullYear();

  // User total experience
  const userTotalYears = userJobs.reduce((s, j) => s + Math.max(0, j.years_employment ?? 0), 0);
  const personTotalYears = pastJobs.reduce((s, j) => s + tenureYears(j), 0);

  // Career phase alignment
  const phase = (y: number) => (y < 3 ? "early" : y < 10 ? "mid" : "late");
  const phaseMatch = phase(userTotalYears) === phase(personTotalYears) ? 1.0 : 0.45;

  // Recency — prefer people who have been active recently
  const personRecent = parseYear(person.current_position?.started_at);
  const recency =
    personRecent >= currentYear - 2  ? 1.00 :
    personRecent >= currentYear - 5  ? 0.85 :
    personRecent >= currentYear - 9  ? 0.65 : 0.40;

  // Era overlap between user's career and person's career history
  let eraScore = 0.5;
  if (userStartYears.length > 0 && pastJobs.length > 0) {
    const personYears = pastJobs.map((j) => parseYear(j.started_at));
    const minU = Math.min(...userStartYears);
    const maxU = Math.max(...userStartYears, currentYear);
    const overlap = personYears.filter((y) => y >= minU - 4 && y <= maxU + 2).length;
    eraScore = overlap > 0 ? Math.min(1, 0.5 + (overlap / personYears.length) * 0.5) : 0.30;
  }

  return phaseMatch * 0.40 + recency * 0.35 + eraScore * 0.25;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Company Context  (7%)
// ─────────────────────────────────────────────────────────────────────────────

function companyContextScore(userCompanies: string[], person: LiveDataPerson): number {
  if (!userCompanies.length) return 0.5;
  const personComps = [
    person.current_position?.company?.name,
    ...person.job_history.map((j) => j.company?.name),
  ]
    .filter(Boolean)
    .map((c) => c!.toLowerCase().trim());

  const userCompsLow = userCompanies.map((c) => c.toLowerCase().trim());

  // Exact company name overlap
  for (const uc of userCompsLow) {
    if (personComps.some((pc) => pc === uc || pc.includes(uc) || uc.includes(pc))) return 1.0;
  }

  // Shared meaningful company name tokens
  const uToks = userCompsLow.flatMap((c) => c.split(/\s+/).filter((w) => w.length > 3));
  const pToks = personComps.flatMap((c) => c.split(/\s+/).filter((w) => w.length > 3));
  if (uToks.some((t) => pToks.includes(t))) return 0.65;

  return 0.30;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Location Proximity  (4%)
// ─────────────────────────────────────────────────────────────────────────────

function locationScore(userLocations: string[], personLocation: string | undefined): number {
  if (!personLocation) return 0.25;
  const pLoc = personLocation.toLowerCase().trim();
  if (!pLoc) return 0.25;
  let best = 0;
  for (const ul of userLocations) {
    if (!ul) continue;
    const uLoc = ul.toLowerCase().trim();
    if (!uLoc) continue;
    if (pLoc === uLoc || pLoc.includes(uLoc) || uLoc.includes(pLoc)) return 1.0;
    const pP = pLoc.split(/[,\s]+/).filter(Boolean);
    const uP = uLoc.split(/[,\s]+/).filter(Boolean);
    const pState = pP.length >= 2 ? pP[pP.length - 2] : null;
    const uState = uP.length >= 2 ? uP[uP.length - 2] : null;
    if (pState && uState && pState.length >= 2 && pState === uState) { best = Math.max(best, 0.75); continue; }
    const pCtry = pP[pP.length - 1];
    const uCtry = uP[uP.length - 1];
    if (pCtry && uCtry && (pCtry === uCtry || pLoc.includes(uCtry) || uLoc.includes(pCtry))) best = Math.max(best, 0.50);
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Education Signal  (10%)
// Infers career direction from the user's major → person's job function.
// ─────────────────────────────────────────────────────────────────────────────

/** Maps major keywords to likely job functions */
const MAJOR_FUNCTION_MAP: Array<{ keywords: string[]; functions: JobFunction[] }> = [
  { keywords: ["computer science", "software engineering", "computer engineering", "informatics", "information technology"],
    functions: ["engineering", "data_science", "product"] },
  { keywords: ["electrical engineering", "electronics", "computer and electrical"],
    functions: ["engineering"] },
  { keywords: ["mechanical engineering", "aerospace engineering", "civil engineering", "chemical engineering", "industrial engineering", "biomedical engineering"],
    functions: ["engineering", "operations"] },
  { keywords: ["data science", "data analytics", "machine learning", "artificial intelligence", "statistics", "mathematics", "applied mathematics"],
    functions: ["data_science", "engineering"] },
  { keywords: ["information systems", "management information systems", "mis"],
    functions: ["engineering", "product", "operations"] },
  { keywords: ["business administration", "business", "management", "entrepreneurship", "commerce"],
    functions: ["sales", "marketing", "operations", "finance"] },
  { keywords: ["finance", "accounting", "economics", "financial economics"],
    functions: ["finance"] },
  { keywords: ["marketing", "advertising", "communications", "public relations", "journalism"],
    functions: ["marketing", "sales", "customer_success"] },
  { keywords: ["design", "graphic design", "industrial design", "ux design", "ui design", "art"],
    functions: ["design"] },
  { keywords: ["product management", "product design"],
    functions: ["product", "design"] },
  { keywords: ["psychology", "sociology", "human resources", "organizational behavior"],
    functions: ["customer_success", "marketing", "product"] },
  { keywords: ["sales", "retail management"],
    functions: ["sales", "customer_success"] },
  { keywords: ["operations management", "supply chain", "logistics"],
    functions: ["operations"] },
];

function educationScore(
  education: UserEducationEntry[],
  person: LiveDataPerson,
): number {
  if (!education.length) return 0.5; // neutral — no education provided

  const pos = person.current_position;
  const personFn = pos?.function ? String(pos.function) : null;

  let bestScore = 0.5; // default: neutral

  for (const edu of education) {
    if (!edu.school_name?.trim()) continue;
    const majorLow = (edu.major ?? "").toLowerCase().trim();
    if (!majorLow) continue;

    for (const { keywords, functions } of MAJOR_FUNCTION_MAP) {
      const majorMatches = keywords.some(
        (kw) => majorLow.includes(kw) || kw.includes(majorLow.split(" ")[0]),
      );
      if (!majorMatches) continue;

      if (personFn && functions.includes(personFn as JobFunction)) {
        bestScore = Math.max(bestScore, 1.0); // strong alignment
      } else if (personFn) {
        // Major maps to a different function → slight penalty
        bestScore = Math.max(bestScore, 0.25);
      }
      break;
    }
  }

  return bestScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCORING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comprehensive 10-signal match score (sums to 1.0):
 *
 *  Signal                   Weight
 *  ─────────────────────── ──────
 *  Current title relevance   25%
 *  Career trajectory          16%   (person's past titles vs user's titles)
 *  Education / major           10%  (major → job function alignment)
 *  Experience level fit        12%
 *  Role type alignment          9%
 *  Salary band alignment        8%
 *  Career timing & recency      7%
 *  Company context              7%
 *  Location proximity           4%
 *  Function match               2%
 */
export function similarityScore(
  userJobs: UserJobEntry[],
  person: LiveDataPerson,
  userStartYears: number[] = [],
  userEducation: UserEducationEntry[] = [],
): number {
  const pos = person.current_position;
  if (!pos?.title) return 0;

  const userTitles    = userJobs.map((j) => j.title).filter(Boolean) as string[];
  const pastTitles    = person.job_history.map((j) => j.title).filter(Boolean) as string[];
  const userCompanies = userJobs.map((j) => j.company_name).filter(Boolean) as string[];
  const userRoleTypes = userJobs.map((j) => j.role_type ?? "").filter(Boolean);
  const userLocations = userJobs.map((j) => j.location ?? "").filter(Boolean);
  const userFns       = new Set(userJobs.map((j) => j.function).filter(Boolean) as string[]);

  // 1 & 2 — Title (25% current + 16% history)
  const curTitleScore  = bestTitleSimilarity(userTitles, [pos.title]);
  const histTitleScore = person.job_history.length ? bestTitleSimilarity(userTitles, pastTitles) : 0;
  let titleScore       = curTitleScore * 0.25 + histTitleScore * 0.16;

  // Internship bonus: if the user has any internship role type AND the person's
  // current title contains "intern", give a modest boost so intern results surface
  // naturally among the top results (but don't dominate — only ~40% of results should be intern)
  const userHasInternship = userRoleTypes.some((rt) => rt.toLowerCase().includes("intern") || rt.toLowerCase() === "trainee");
  const personTitleIsIntern = pos.title.toLowerCase().includes("intern");
  if (userHasInternship && personTitleIsIntern) {
    titleScore = Math.min(titleScore + 0.08, 0.46); // small lift, capped so non-intern can still outrank
  }

  // 3 — Education / major alignment (10%)
  const eduScore = educationScore(userEducation, person) * 0.10;

  // 4 — Experience level fit (12%)
  const userAvgLevel  = avgLevelOrd(userJobs.map((j) => j.level));
  const personLevel   = levelOrdinal(pos.level);
  const expScore      = experienceLevelScore(userAvgLevel, personLevel) * 0.12;

  // 5 — Role type alignment (9%)
  const rtScore = roleTypeScore(userRoleTypes, pos.role_type) * 0.09;

  // 6 — Salary band alignment (8%)
  const salScore = salaryBandScore(userJobs, pos.level) * 0.08;

  // 7 — Career timing & recency (7%)
  const timingScore = careerTimingScore(userJobs, person, userStartYears) * 0.07;

  // 8 — Company context (7%)
  const compScore = companyContextScore(userCompanies, person) * 0.07;

  // 9 — Location proximity (4%)
  const locScore = locationScore(userLocations, pos.location) * 0.04;

  // 10 — Function match (2%)
  const personFn = pos.function ? String(pos.function) : null;
  const fnRaw    = !userFns.size ? 0.5 : personFn && userFns.has(personFn) ? 1.0 : 0.0;
  const fnScore  = fnRaw * 0.02;

  return titleScore + eduScore + expScore + rtScore + salScore + timingScore + compScore + locScore + fnScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH REASONS
// ─────────────────────────────────────────────────────────────────────────────

export function getMatchReasons(
  userJobs: UserJobEntry[],
  person: LiveDataPerson,
  userStartYears: number[] = [],
  userEducation: UserEducationEntry[] = [],
): string[] {
  const reasons: string[] = [];
  const pos = person.current_position;
  if (!pos) return ["Matched to your career pathway."];

  const userTitles    = userJobs.map((j) => (j.title ?? "").trim()).filter(Boolean);
  const pastTitles    = person.job_history.map((j) => j.title).filter(Boolean) as string[];
  const userFns       = [...new Set(userJobs.map((j) => j.function).filter(Boolean))] as JobFunction[];
  const userAvgLevel  = avgLevelOrd(userJobs.map((j) => j.level));
  const personLevel   = levelOrdinal(pos.level);
  const userTotal     = userJobs.reduce((s, j) => s + Math.max(0, j.years_employment ?? 0), 0);
  const personTotal   = person.job_history.reduce((s, j) => s + tenureYears(j), 0);
  const userSalaries  = userJobs.map((j) => j.salary ?? 0).filter((s) => s > 0);
  const userRoleTypes = userJobs.map((j) => j.role_type ?? "").filter(Boolean);
  const userCompanies = userJobs.map((j) => j.company_name).filter(Boolean) as string[];
  const userLocations = userJobs.map((j) => j.location ?? "").filter(Boolean);
  const currentYear   = new Date().getFullYear();

  // — Title relevance
  const curSim = bestTitleSimilarity(userTitles, [pos.title]);
  if (curSim >= 0.60) {
    reasons.push(`Strong title match — "${pos.title}" aligns directly with your background`);
  } else if (curSim >= 0.30) {
    reasons.push(`"${pos.title}" is closely related to your professional experience`);
  }

  // — Career path
  const histSim = bestTitleSimilarity(userTitles, pastTitles);
  if (histSim >= 0.60) {
    reasons.push("People with your exact background commonly transition into this role");
  } else if (histSim >= 0.30) {
    reasons.push("Common career pathway from your background to this position");
  }

  // — Shared company
  const userCompsLow = userCompanies.map((c) => c.toLowerCase().trim());
  const personComps  = [pos.company?.name, ...person.job_history.map((j) => j.company?.name)]
    .filter(Boolean).map((c) => c!.toLowerCase());
  if (userCompsLow.some((uc) => personComps.some((pc) => pc.includes(uc) || uc.includes(pc)))) {
    reasons.push("Shared company history — strong cultural and career pathway alignment");
  }

  // — Role type
  const rtSc = roleTypeScore(userRoleTypes, pos.role_type);
  if (rtSc >= 0.9 && userRoleTypes.length) {
    const label = userRoleTypes[0].replace(/-/g, " ");
    reasons.push(`Employment type matches your preference (${label})`);
  } else if (userRoleTypes.some((t) => TRAINING.has(normRT(t))) && pos.role_type && FULL_TIME_LIKE.has(normRT(pos.role_type))) {
    reasons.push("Natural progression from internship to full-time role");
  }

  // — Salary alignment
  if (userSalaries.length) {
    const avgSal = userSalaries.reduce((a, b) => a + b, 0) / userSalaries.length;
    const level  = (pos.level ?? "entry").toLowerCase();
    const [bandMin, bandMax] = LEVEL_SALARY_BAND[level] ?? [50_000, 150_000];
    if (avgSal >= bandMin * 0.80 && avgSal <= bandMax * 1.20) {
      const fmt = (n: number) => `$${Math.round(n / 1_000)}k`;
      reasons.push(`Salary band aligns with your history — typical range ${fmt(bandMin)}–${fmt(bandMax)}`);
    }
  }

  // — Experience level
  const gap = personLevel - userAvgLevel;
  if (gap === 0) {
    reasons.push(`Exact experience level match (${pos.level ?? "your current level"})`);
  } else if (gap === 1) {
    reasons.push(`Natural next step up in seniority (${pos.level ?? "one level up"})`);
  } else if (gap < 0) {
    reasons.push(`Well within your experience range (${pos.level ?? "your level"})`);
  } else if (gap === 2 && pos.level) {
    reasons.push(`Stretch opportunity — ${pos.level} level role`);
  }

  // — Tenure similarity
  if (Math.abs(userTotal - personTotal) <= 2) {
    reasons.push(`Similar total experience — ${Math.round(personTotal)} years in the field`);
  }

  // — Recency
  const personRecent = parseYear(person.current_position?.started_at);
  if (personRecent >= currentYear - 2) {
    reasons.push("Recently filled role — reflects current market conditions");
  }

  // — Function
  const personFn = pos.function ? String(pos.function) : null;
  const sharedFn = userFns.find((f) => f === personFn);
  if (sharedFn) reasons.push(`Matches your career function (${sharedFn.replace(/_/g, " ")})`);

  // — Location
  const locSc = locationScore(userLocations, pos.location);
  if (locSc >= 1.0 && pos.location) {
    reasons.push(`Role is in your area — ${pos.location}`);
  } else if (locSc >= 0.70 && pos.location) {
    reasons.push(`Same region — ${pos.location}`);
  }

  // — Education alignment
  if (userEducation.length > 0) {
    const personFnStr = pos.function ? String(pos.function) : null;
    for (const edu of userEducation) {
      const majorLow = (edu.major ?? "").toLowerCase().trim();
      if (!majorLow) continue;
      const mapped = MAJOR_FUNCTION_MAP.find(({ keywords }) =>
        keywords.some((kw) => majorLow.includes(kw) || kw.includes(majorLow.split(" ")[0]))
      );
      if (mapped && personFnStr && mapped.functions.includes(personFnStr as JobFunction)) {
        const school = edu.school_name ? ` (${edu.school_name.split(" ").slice(0, 2).join(" ")})` : "";
        reasons.push(`Your ${edu.major} background${school} aligns with this career path`);
        break;
      }
    }
  }

  if (!reasons.length) reasons.push("Matches your career pathway based on LiveData workforce patterns");
  return reasons.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchResult {
  person: LiveDataPerson;
  score: number;
  suggestedRole: string;
  suggestedFunction: JobFunction;
  suggestedLevel: JobLevel;
  matchReasons?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FIND SIMILAR PEOPLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rank the full candidate pool and return up to topK results.
 * Default topK = 36 (3 pages × 12 per page).
 */
export function findSimilarPeople(
  userJobs: UserJobEntry[],
  topK = 36,
  people: LiveDataPerson[],
  userStartYears: number[] = [],
  userEducation: UserEducationEntry[] = [],
): MatchResult[] {
  if (!userJobs.length || !people.length) return [];

  const safe = userJobs.filter(
    (j) => String(j.company_name ?? "").trim() || String(j.title ?? "").trim(),
  );
  if (!safe.length) return [];

  // Score every candidate that has a current job
  const scored = people
    .filter((p) => p.current_position?.title && p.current_position?.company?.name)
    .map((person) => ({ person, rawScore: similarityScore(safe, person, userStartYears, userEducation) }));

  scored.sort((a, b) => b.rawScore - a.rawScore);

  // Deduplicate by company + title for maximum diversity in results
  const seen = new Set<string>();
  const deduped: typeof scored = [];
  for (const x of scored) {
    const key = [
      (x.person.current_position.company.name ?? "").toLowerCase(),
      (x.person.current_position.title ?? "").toLowerCase(),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(x);
    if (deduped.length >= topK) break;
  }

  if (!deduped.length) return [];

  // Normalize: top → ~93%, bottom → ~45%, preserving relative spread
  const maxRaw  = deduped[0].rawScore;
  const minRaw  = deduped[deduped.length - 1].rawScore;
  const rawRange = Math.max(maxRaw - minRaw, 0.01);

  return deduped.map(({ person, rawScore }) => {
    const score = Math.min(0.95, 0.45 + ((rawScore - minRaw) / rawRange) * 0.50);
    const pos   = person.current_position;
    return {
      person,
      score,
      suggestedRole:     pos.title    ?? "Role",
      suggestedFunction: pos.function ?? ("engineering" as JobFunction),
      suggestedLevel:    pos.level    ?? ("entry" as JobLevel),
      matchReasons:      getMatchReasons(safe, person, userStartYears, userEducation),
    };
  });
}
