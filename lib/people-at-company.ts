/**
 * LiveDataTechnologies: people who worked at a company, with similar career pathway.
 */

import type { LiveDataPerson, LiveDataJob } from "./livedata-types";

/** Build a LinkedIn people-search URL (dataset-only: we don't have per-person LinkedIn URLs). */
function getCompanyLinkedInUrl(companyName: string): string {
  const normalized = companyName.trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(normalized)}`;
}

function workedAtCompany(person: LiveDataPerson, companyName: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(companyName);
  const at = (j: LiveDataJob) => norm(j.company.name) === target;
  return person.job_history.some(at) || at(person.current_position);
}

/** Short job history string: "Intern at Stripe → Engineer at Vercel" */
export function formatShortJobHistory(person: LiveDataPerson, maxJobs = 4): string {
  const all = [...(person.job_history ?? []), person.current_position].filter(Boolean);
  // Prefer most recent roles (by started_at); always include current_position.
  const sorted = all
    .slice()
    .sort((a, b) => (String(b.started_at ?? "")).localeCompare(String(a.started_at ?? "")));
  const picked = sorted.slice(0, Math.max(1, Math.min(8, maxJobs)));
  return picked.map((j) => `${j.title} at ${j.company.name}`).join(" → ");
}

/**
 * Returns up to 3 people who worked at the given company from LiveDataTechnologies data.
 * Prefers people whose function matches the role (e.g. engineering) for similar career pathway.
 */
export function getPeopleWhoWorkedAtCompany(
  companyName: string,
  people: LiveDataPerson[],
  options?: { function?: string; level?: string; limit?: number }
): LiveDataPerson[] {
  const limit = options?.limit ?? 3;
  const preferredFunction = options?.function?.trim().toLowerCase();
  const preferredLevel = options?.level?.trim().toLowerCase();

  const candidates = (people ?? []).filter((p) => workedAtCompany(p, companyName));

  const withScore = candidates.map((p) => {
    const allJobs = [...p.job_history, p.current_position];
    const atCompany = allJobs.filter(
      (j) => j.company.name.trim().toLowerCase() === companyName.trim().toLowerCase()
    );
    const primaryFunction = atCompany[0]?.function ?? p.current_position.function;
    const primaryLevel = atCompany[0]?.level ?? p.current_position.level;
    let score = 0;
    if (preferredFunction && primaryFunction === preferredFunction) score += 2;
    if (preferredLevel && primaryLevel === preferredLevel) score += 1;
    return { person: p, score };
  });

  withScore.sort((a, b) => b.score - a.score);
  const companyLinkedInUrl = getCompanyLinkedInUrl(companyName);
  const top = withScore.slice(0, limit).map(({ person }) => ({
    ...person,
    // Dataset does not include real person names. Use a meaningful label from the profile itself.
    display_name: `${person.current_position.title}${person.current_position.location_details?.city ? ` • ${person.current_position.location_details.city}` : ""}`,
    linkedin_url: companyLinkedInUrl,
  }));

  return top;
}
