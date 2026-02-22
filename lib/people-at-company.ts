/**
 * LiveDataTechnologies: people who worked at a company, with similar career pathway.
 */

import type { LiveDataPerson, LiveDataJob } from "./livedata-types";
import { MOCK_PEOPLE } from "./mock-livedata";

/** Display names for each person (for UI). */
const PERSON_DISPLAY_NAMES: Record<string, string> = {
  p1: "Jordan Lee", p2: "Sam Rivera", p3: "Alex Chen", p4: "Morgan Taylor", p5: "Riley Kim",
  p6: "Casey Evans", p7: "Jamie Foster", p8: "Quinn Martinez", p9: "Drew Nguyen", p10: "Skyler Brooks",
  p11: "Avery Hayes", p12: "Reese Clark", p13: "Cameron Wright", p14: "Parker Adams", p15: "Blake Scott",
  p16: "Sage Green", p17: "Finley Hall", p18: "Emery King", p19: "Rowan Bell", p20: "Dakota Reed",
  p21: "Harper Hill", p22: "Phoenix Ward", p23: "River Cooper", p24: "Shiloh Bailey", p25: "Arlo Nelson",
  p26: "Indigo Carter", p27: "Sawyer Mitchell", p28: "Peyton Roberts", p29: "Emerson Turner", p30: "Finley Phillips",
  p31: "Quinn Campbell", p32: "Sage Parker", p33: "Remy James", p34: "Jesse Morgan", p35: "Robin Kelly",
  p36: "Drew Sullivan", p37: "Avery Bennett", p38: "Riley Gray", p39: "Jordan Ross", p40: "Casey Powell",
  p41: "Sam Liu", p42: "Alex Park", p43: "Morgan Davis", p44: "Jamie White", p45: "Quinn Brown",
};

/** LinkedIn company page slugs (linkedin.com/company/SLUG) so "View on LinkedIn" links work. */
const COMPANY_LINKEDIN_SLUGS: Record<string, string> = {
  Stripe: "stripe", Vercel: "vercel", Notion: "notion", Figma: "figma", Meta: "meta",
  Anthropic: "anthropic", Google: "google", OpenAI: "openai", Airbnb: "airbnb", Linear: "linear",
  Salesforce: "salesforce", HubSpot: "hubspot", Amazon: "amazon", Slack: "slack", Microsoft: "microsoft",
  Apple: "apple", Netflix: "netflix", Adobe: "adobe", Spotify: "spotify", Dropbox: "dropbox",
  Square: "square", Asana: "asana", Atlassian: "atlassian", Twilio: "twilio", Snowflake: "snowflake",
  Databricks: "databricks", Nvidia: "nvidia", GitHub: "github", MongoDB: "mongodb", Zoom: "zoom",
  DocuSign: "docusign", Okta: "okta", ServiceNow: "servicenow", Workday: "workday", IBM: "ibm",
  Oracle: "oracle", Cisco: "cisco", Elastic: "elastic", HashiCorp: "hashicorp", GitLab: "gitlab",
  Twitch: "twitch", Lyft: "lyft", Uber: "uber", DoorDash: "doordash", Coinbase: "coinbase",
};

/** Build a working LinkedIn URL for the company (People page so users can find real profiles). */
function getCompanyLinkedInUrl(companyName: string): string {
  const normalized = companyName.trim();
  const slug = COMPANY_LINKEDIN_SLUGS[normalized];
  if (slug) {
    return `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/`;
  }
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(normalized)}`;
}

function workedAtCompany(person: LiveDataPerson, companyName: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(companyName);
  const at = (j: LiveDataJob) => norm(j.company.name) === target;
  return person.job_history.some(at) || at(person.current_position);
}

/** Short job history string: "Intern at Stripe → Engineer at Vercel" */
export function formatShortJobHistory(person: LiveDataPerson): string {
  const all = [...person.job_history, person.current_position];
  return all
    .map((j) => `${j.title} at ${j.company.name}`)
    .join(" → ");
}

/**
 * Returns up to 3 people who worked at the given company from LiveDataTechnologies data.
 * Prefers people whose function matches the role (e.g. engineering) for similar career pathway.
 */
export function getPeopleWhoWorkedAtCompany(
  companyName: string,
  options?: { function?: string; level?: string; limit?: number }
): LiveDataPerson[] {
  const limit = options?.limit ?? 3;
  const preferredFunction = options?.function?.trim().toLowerCase();
  const preferredLevel = options?.level?.trim().toLowerCase();

  const candidates = MOCK_PEOPLE.filter((p) => workedAtCompany(p, companyName));

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
    display_name: PERSON_DISPLAY_NAMES[person.id] ?? "Professional",
    linkedin_url: companyLinkedInUrl,
  }));

  return top;
}
