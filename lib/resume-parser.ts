import type { UserJobEntry, RoleType } from "./livedata-types";

const ROLE_TYPES: RoleType[] = ["intern", "full-time", "part-time", "contract", "freelance"];

/** Section headers that indicate job/work experience (parse only these). */
const EXPERIENCE_HEADERS = [
  "work experience",
  "professional experience",
  "employment",
  "employment history",
  "experience",
  "career",
  "work history",
  "positions",
  "relevant experience",
  "professional history",
];

/** Section headers that end the experience section (do not parse these or anything after). */
const STOP_HEADERS = [
  "skills",
  "technical skills",
  "core competencies",
  "projects",
  "education",
  "academic",
  "certifications",
  "certificates",
  "awards",
  "honors",
  "volunteer",
  "extracurricular",
  "summary",
  "objective",
  "about",
  "references",
  "languages",
  "interests",
  "activities",
  "publications",
  "patents",
];

/** Match date range patterns: "2020 - Present", "2018 – 2021", "Jan 2020 - Dec 2022", "Jan. 2020", "2019 to 2021" */
const DATE_RANGE_REGEX =
  /\d{4}\s*[–\-—]\s*(?:Present|\d{4})|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s*\d{4}\s*[–\-—]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s*)?\d{4}|\d{4}\s+to\s+\d{4}/gi;

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse "Jan 2020" or "2020" to approximate month index (1–12) and year. */
function parseDatePart(s: string): { year: number; month: number } {
  const trimmed = s.trim();
  const yearMatch = trimmed.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
  const monthStr = trimmed.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*/i)?.[0];
  const month = monthStr ? (MONTH_NAMES[monthStr.slice(0, 3).toLowerCase()] ?? 6) : 6;
  return { year, month };
}

/** Calculate years employed from a date range string (supports fractional years from month names). */
function estimateYearsFromDateRange(match: string): number {
  const now = new Date();
  const hadPresent = /Present/i.test(match);
  const normalized = match.replace(/Present/i, String(now.getFullYear())).trim();
  const parts = normalized.split(/\s*[–\-—]\s*|\s+to\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return 2;
  const start = parseDatePart(parts[0]);
  let end = parseDatePart(parts[parts.length - 1]);
  if (hadPresent) {
    end = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  if (end.year < start.year) return 2;
  const startMonths = start.year * 12 + start.month;
  const endMonths = end.year * 12 + end.month;
  const monthsDiff = Math.max(1, endMonths - startMonths);
  const years = monthsDiff / 12;
  return Math.min(20, Math.max(0.08, Math.round(years * 10) / 10));
}

/** Match "Position (Company)" – company may contain commas. Allows trailing text (e.g. date on same line). */
const POSITION_COMPANY_REGEX = /^(.+?)\s*\(([^)]+)\)/;

/** True if the line looks like a section header (all caps or title case, short, no date). */
function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (t.length > 50 || t.length < 2) return false;
  const noDigits = /^\D*$/.test(t);
  const looksLikeTitle = /^[A-Z][a-z]*(?:\s+[A-Za-z]+)*\s*$/.test(t) || t === t.toUpperCase();
  return noDigits && looksLikeTitle;
}

/** True if the line is the start of a non-experience section (stop parsing). */
function isStopSection(line: string): boolean {
  const lower = line.trim().toLowerCase();
  return STOP_HEADERS.some((h) => lower === h || lower.startsWith(h + " ") || lower.startsWith(h + ":"));
}

/** True if the line looks like an experience section we should parse. */
function isExperienceSection(line: string): boolean {
  const lower = line.trim().toLowerCase();
  return EXPERIENCE_HEADERS.some((h) => lower === h || lower.startsWith(h + " ") || lower.startsWith(h + ":"));
}

/** Extract only the experience-section body: from an experience header until a stop header or next same-level section. */
function extractExperienceSectionText(normalized: string): string {
  const lines = normalized.split("\n");
  let inExperience = false;
  const collected: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (inExperience) collected.push("");
      continue;
    }
    if (isStopSection(trimmed)) {
      inExperience = false;
      continue;
    }
    if (isExperienceSection(trimmed)) {
      inExperience = true;
      continue;
    }
    if (inExperience && isSectionHeader(trimmed)) {
      const lower = trimmed.toLowerCase();
      const isOtherSection = STOP_HEADERS.some((h) => lower === h || lower.startsWith(h + ":"));
      if (isOtherSection) {
        inExperience = false;
        continue;
      }
    }
    if (inExperience) collected.push(trimmed);
  }

  return collected.join("\n");
}

/** Reject lines that look like skill lists, bullet notes, or non-job titles. Allow "(Company)" only lines. */
function looksLikeJobTitleOrCompany(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 120) return false;
  if (/^\s*\([^)]+\)\s*$/.test(t)) return true;
  const lower = t.toLowerCase();
  if (lower.startsWith("•") || lower.startsWith("- ") || lower.startsWith("* ") || lower.startsWith("· ")) {
    const rest = t.slice(t.search(/\S/) + 1).trim();
    if (rest.length < 3) return false;
    if (/,| and |;/.test(rest) && rest.split(/[,;]| and /).length > 2) return false;
  }
  if (/,| and |;/.test(t) && t.split(/[,;]| and /).filter(Boolean).length > 3) return false;
  if (/^(proficient|experienced|skilled|knowledge of|expert in)/i.test(t)) return false;
  if (/^(led|built|developed|implemented|managed|designed)\s/i.test(t)) return false;
  return true;
}

/**
 * Parse resume text into job entries only.
 * Uses only the Experience / Work Experience section; ignores Skills, Projects, Education, etc.
 */
export function parseResumeText(text: string): UserJobEntry[] {
  const entries: UserJobEntry[] = [];
  if (!text || !text.trim()) return entries;

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  let experienceText = extractExperienceSectionText(normalized);
  if (!experienceText.trim()) {
    const allLines = normalized.split("\n");
    const stopAt = allLines.findIndex((l) => isStopSection(l.trim()));
    experienceText = stopAt >= 0 ? allLines.slice(0, stopAt).join("\n") : normalized;
  }

  const lines = experienceText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: { lines: string[]; years?: number }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(DATE_RANGE_REGEX);
    if (dateMatch) {
      const years = estimateYearsFromDateRange(dateMatch[0]);
      const prevLines: string[] = [];
      let j = i - 1;
      while (j >= 0 && lines[j] && !lines[j].match(DATE_RANGE_REGEX) && prevLines.length < 4) {
        const candidate = lines[j];
        if (looksLikeJobTitleOrCompany(candidate)) prevLines.unshift(candidate);
        j--;
      }
      if (prevLines.length >= 1) {
        blocks.push({ lines: prevLines, years });
      }
    }
    i++;
  }

  for (const block of blocks) {
    const first = (block.lines[0] ?? "").trim();
    const second = (block.lines[1] ?? "").trim();
    if (!first) continue;
    const combined = block.lines.map((l) => l.trim()).filter(Boolean).join(" ");
    let title = first;
    let company = "";
    const positionCompanyMatch = combined.match(POSITION_COMPANY_REGEX);
    if (positionCompanyMatch) {
      title = positionCompanyMatch[1].trim();
      company = positionCompanyMatch[2].trim();
    } else if (/^\s*\(([^)]+)\)\s*$/.test(second)) {
      company = second.replace(/^\s*\(([^)]+)\)\s*$/, "$1").trim();
      title = first;
    } else if (second && looksLikeJobTitleOrCompany(second)) {
      company = second.replace(/^\s*\(([^)]+)\)\s*$/, "$1").trim() || second;
    } else if (/ at /i.test(combined)) {
      const parts = combined.split(/\s+at\s+/i);
      if (parts.length >= 2) {
        title = parts[0].trim();
        company = parts.slice(1).join(" ").trim();
      }
    }
    if (!company) company = title;
    const roleType: RoleType =
      (ROLE_TYPES.find((r) => title.toLowerCase().includes(r)) as RoleType | undefined) ?? "full-time";
    entries.push({
      company_name: company,
      years_employment: block.years ?? 2,
      salary: 0,
      role_type: roleType,
      title: title || "Role",
      location: "",
    });
  }

  return entries.slice(0, 10);
}
