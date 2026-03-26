import { NextResponse } from "next/server";

const LD_BASE = `https://gotlivedata.io/api/people/v1/${process.env.LIVEDATA_ORG_ID}`;
const LD_KEY  = process.env.LIVEDATA_API_KEY ?? "";
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

interface ChatMessage { role: "user" | "assistant"; text: string; }

interface UserContext {
  jobHistory: { title: string; company: string; years: number }[];
  savedRoles: { role: string; company: string }[];
  targetRole?: string;
  targetCompany?: string;
}

// ── LiveData API ──────────────────────────────────────────────────────────────

/** Correct nested filter format required by the LiveData API */
function companyFilter(name: string) {
  return {
    operator: "and",
    filters: [{ field: "jobs.company.name", type: "must", match_type: "fuzzy", string_values: [name] }],
  };
}

function titleFilter(title: string) {
  return {
    operator: "and",
    filters: [{ field: "jobs.title", type: "must", match_type: "fuzzy", string_values: [title] }],
  };
}

async function ldSearch(filters: object[], size = 20): Promise<{ people: any[]; count: number }> {
  try {
    const res = await fetch(`${LD_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LD_KEY}` },
      body: JSON.stringify({ filters, size }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { people: [], count: 0 };
    const d = await res.json();
    return { people: d.people ?? [], count: d.count ?? 0 };
  } catch { return { people: [], count: 0 }; }
}

// ── Data extractors ───────────────────────────────────────────────────────────

const curTitle    = (p: any): string => p.position?.title ?? p.current_position?.title ?? "";
const curCompany  = (p: any): string => p.position?.company?.name ?? p.current_position?.company?.name ?? "";
const curIndustry = (p: any): string => p.position?.company?.industry ?? p.current_position?.company?.industry ?? "";
const empCount    = (p: any): number => p.position?.company?.employee_count ?? p.current_position?.company?.employee_count ?? 0;

function topN(arr: string[], n: number): string[] {
  const counts: Record<string, number> = {};
  for (const v of arr) if (v) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function prevCompanies(p: any): string[] {
  return (p.jobs ?? []).filter((j: any) => j.company?.name && j.company.name !== curCompany(p))
    .map((j: any) => j.company.name as string);
}
function prevTitles(p: any): string[] {
  return (p.jobs ?? []).filter((j: any) => j.title && j.title !== curTitle(p))
    .map((j: any) => j.title as string);
}
function avgTenure(people: any[]): number | null {
  const t = people.flatMap(p => {
    const s = p.position?.started_at ?? p.current_position?.started_at;
    if (!s) return [];
    const y = (Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24 * 365);
    return y > 0 && y < 50 ? [y] : [];
  });
  return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
}

// ── Intent + entity detection ─────────────────────────────────────────────────

type Intent = "company_info" | "people_at_company" | "role_info" | "career_path"
            | "interview_prep" | "salary" | "job_search" | "resume" | "hiring_trends" | "general";

function detectIntent(msg: string): Intent {
  const q = msg.toLowerCase();
  if (/\b(salary|pay|compens|earn|wage|how much)\b/.test(q)) return "salary";
  if (/\b(interview|prep|behavioral|star method|tell me about yourself|what questions)\b/.test(q)) return "interview_prep";
  if (/\b(resume|cv|cover letter)\b/.test(q)) return "resume";
  if (/\b(career path|how to become|get promoted|transition|move (from|into)|progression)\b/.test(q)) return "career_path";
  if (/\b(who works|people at|employees at|team at|how many people)\b/.test(q)) return "people_at_company";
  if (/\b(hiring|job market|demand|trend|layoff|growing)\b/.test(q)) return "hiring_trends";
  if (/\b(find a? job|job search|where (to apply|should i apply)|best companies for)\b/.test(q)) return "job_search";
  if (/\b(engineer|analyst|manager|designer|developer|scientist|recruiter|strategist|consultant|director)\b/.test(q) &&
      !/\b(what is|who is)\b/.test(q)) return "role_info";
  if (/\b(what is|tell me about|about|explain|describe|who is)\b/.test(q)) return "company_info";
  return "general";
}

const KNOWN_COMPANIES = [
  "wells fargo","goldman sachs","jp morgan","jpmorgan","morgan stanley","bank of america",
  "google","apple","meta","microsoft","amazon","netflix","tesla","nvidia","openai","anthropic",
  "stripe","airbnb","uber","lyft","doordash","instacart","coinbase","robinhood","palantir",
  "salesforce","oracle","ibm","intel","amd","qualcomm","cisco","adobe","servicenow",
  "mckInsey","bain","bcg","deloitte","pwc","kpmg","ey","accenture",
];

function extractCompany(msg: string): string | null {
  const q = msg.toLowerCase();
  for (const c of KNOWN_COMPANIES) { if (q.includes(c)) return c; }
  // Pattern-based for unknown companies
  const patterns = [
    /\bat\s+([a-z][a-z0-9\s&.'-]{2,30}?)(?:\s*[,?!.]|\s+(?:and|or|for)\s|$)/i,
    /\babout\s+([a-z][a-z0-9\s&.'-]{2,30}?)(?:\s*[,?!.]|\s+(?:and|or|for)\s|$)/i,
    /\bwhat (?:is|are)\s+([a-z][a-z0-9\s&.'-]{2,30}?)(?:\s*[?.,]|$)/i,
    /\btell me about\s+([a-z][a-z0-9\s&.'-]{2,30}?)(?:\s*[?.,]|$)/i,
    /([A-Z][A-Za-z0-9]{2,20}(?:\s+[A-Z][A-Za-z0-9]{2,})?)\s+(?:company|corp|inc|llc|ltd)/,
  ];
  for (const p of patterns) {
    const m = msg.match(p)?.[1]?.trim();
    if (m && m.length > 2 && !["the","this","that","your","their","our"].includes(m.toLowerCase())) return m;
  }
  return null;
}

function extractTitle(msg: string): string | null {
  const q = msg.toLowerCase();
  const ordered = [
    "software engineer","data scientist","machine learning engineer","ml engineer",
    "product manager","engineering manager","data analyst","data engineer",
    "ux designer","devops engineer","site reliability engineer","sre",
    "marketing manager","sales manager","business analyst","financial analyst",
    "account executive","solutions engineer","customer success manager",
    "director of engineering","vp of product","chief technology officer","cto","ceo","cfo",
    "engineer","analyst","manager","designer","scientist","recruiter","developer","consultant","director","vp",
  ];
  for (const t of ordered) { if (q.includes(t)) return t; }
  return null;
}

// ── LiveData context builder ──────────────────────────────────────────────────

async function buildLiveDataContext(intent: Intent, company: string | null, title: string | null): Promise<string> {
  const parts: string[] = [];

  if (company) {
    const { people, count } = await ldSearch([companyFilter(company)], 20);
    if (count > 0 && people.length) {
      const titles   = topN(people.map(curTitle), 6).filter(Boolean);
      const industries = topN(people.map(curIndustry), 3).filter(Boolean);
      const fromComps  = topN(people.flatMap(prevCompanies), 6).filter(Boolean);
      const tenure     = avgTenure(people);
      const ec         = people.map(empCount).find(n => n > 0);
      const levels     = topN(people.map((p: any) => p.position?.level ?? ""), 4).filter(Boolean);

      parts.push(`=== LiveData Workforce Data: ${company} ===`);
      parts.push(`Profiles in dataset: ${count.toLocaleString()}`);
      if (ec) parts.push(`Company size: ~${ec.toLocaleString()} employees`);
      if (industries.length) parts.push(`Industry: ${industries.join(", ")}`);
      if (titles.length) parts.push(`Top current roles: ${titles.join(", ")}`);
      if (levels.length) parts.push(`Seniority levels: ${levels.join(", ")}`);
      if (fromComps.length) parts.push(`Employees previously worked at: ${fromComps.join(", ")}`);
      if (tenure !== null) parts.push(`Average current tenure: ${tenure.toFixed(1)} years`);
      parts.push("=== End Company Data ===");
    }
  }

  if (title && (intent === "role_info" || intent === "career_path" || intent === "hiring_trends" || intent === "job_search")) {
    const filters = [titleFilter(title), ...(company ? [companyFilter(company)] : [])];
    const { people, count } = await ldSearch(filters, 15);
    if (count > 0 && people.length) {
      const companies  = topN(people.map(curCompany), 6).filter(Boolean);
      const industries = topN(people.map(curIndustry), 4).filter(Boolean);
      const fromTitles = topN(people.flatMap(prevTitles), 6).filter(Boolean);
      const levels     = topN(people.map((p: any) => p.position?.level ?? ""), 4).filter(Boolean);

      parts.push(`=== LiveData Role Data: "${title}" ===`);
      parts.push(`Professionals with this title: ${count.toLocaleString()}`);
      if (companies.length) parts.push(`Top employers: ${companies.join(", ")}`);
      if (industries.length) parts.push(`Industries: ${industries.join(", ")}`);
      if (levels.length) parts.push(`Seniority: ${levels.join(", ")}`);
      if (fromTitles.length) parts.push(`Career backgrounds (prior titles): ${fromTitles.join(", ")}`);
      parts.push("=== End Role Data ===");
    }
  }

  return parts.join("\n");
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false;
    const d = await r.json();
    return Array.isArray(d.models) && d.models.length > 0;
  } catch { return false; }
}

function buildUserContextBlock(ctx: UserContext | null): string {
  if (!ctx) return "";
  const parts: string[] = ["=== THIS USER'S PROFILE ==="];
  if (ctx.targetRole || ctx.targetCompany) {
    parts.push(`Currently targeting: ${[ctx.targetRole, ctx.targetCompany].filter(Boolean).join(" at ")}`);
  }
  if (ctx.savedRoles.length > 0) {
    parts.push(`Saved roles: ${ctx.savedRoles.map(r => `${r.role} @ ${r.company}`).join(", ")}`);
  }
  if (ctx.jobHistory.length > 0) {
    parts.push(`Job history: ${ctx.jobHistory.map(j => `${j.title} at ${j.company} (${j.years}y)`).join(", ")}`);
  }
  parts.push("=== END USER PROFILE ===");
  return parts.join("\n");
}

function buildSystemPrompt(liveDataContext: string, userCtx: UserContext | null = null): string {
  const userBlock = buildUserContextBlock(userCtx);
  return `You are Nexa, an expert AI career assistant inside NextRound — a job-search platform powered by LiveData Technologies real workforce intelligence.

PERSONALITY: Sharp, direct, warm. Like a senior recruiter who also understands the candidate side deeply. Conversational and specific — not robotic.

FORMATTING RULES (important — follow exactly):
- Use **bold** for the single most important term or phrase per key point — not every word, just the one that matters most.
- Use *italics* sparingly for emphasis on a secondary term or a nuance, maybe once or twice per response.
- Use bullet lists (- item) when giving 3+ parallel tips, steps, or facts. Do NOT use bullets for conversational answers.
- Use numbered lists only for strict step-by-step sequences where order matters.
- Never use markdown headers (no ## or ###).
- No triple backticks or code blocks unless showing actual code.

CONTENT RULES:
- Never identify as GPT, Claude, Llama, or any AI model. You are Nexa.
- Use the LiveData workforce data provided below to ground your answers in real facts. Reference numbers, companies, and patterns from the data naturally.
- When the user profile is available, personalise your answer — reference their target role, saved companies, or background directly.
- LENGTH: default to 2–4 sentences for simple questions. Use lists or multiple paragraphs only for genuinely complex requests (full interview prep, step-by-step career paths). When in doubt, be shorter.
- End with one short follow-up question, no longer than one sentence.

${userBlock ? `${userBlock}\n` : ""}${liveDataContext
  ? `REAL WORKFORCE DATA FOR THIS QUERY (use this — it is live data, not made up):\n${liveDataContext}`
  : "No specific workforce data retrieved for this query. Answer from your career expertise."}`;
}

/** Returns a streaming Response (SSE) piping Ollama tokens, or null on failure */
async function streamOllama(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  intent: Intent,
): Promise<Response | null> {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 40_000);
  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.text })),
          { role: "user", content: userMessage },
        ],
        options: { temperature: 0.65, num_predict: 280 },
      }),
      signal: ctrl.signal,
    });
    if (!ollamaRes.ok || !ollamaRes.body) return null;

    const SHORT_INTENTS: Intent[] = ["company_info", "people_at_company", "salary", "general"];
    const maxSentences = SHORT_INTENTS.includes(intent) ? 3 : 99;

    const encoder = new TextEncoder();
    const reader  = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";
    let   sentenceCount = 0;
    let   done    = false;

    const stream = new ReadableStream({
      async pull(controller) {
        if (done) { controller.close(); return; }
        try {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            done = true;
            return;
          }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              const token: string = json.message?.content ?? "";
              if (token) {
                // Count sentence endings to enforce short-intent cap
                const endings = (token.match(/[.!?]/g) ?? []).length;
                sentenceCount += endings;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
                if (sentenceCount >= maxSentences) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  done = true;
                  return;
                }
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                done = true;
              }
            } catch { /* skip malformed line */ }
          }
        } catch { controller.close(); done = true; }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch { return null; }
}

// ── Smart fallback (no Ollama) ────────────────────────────────────────────────

function fallbackReply(intent: Intent, liveDataContext: string, company: string | null, title: string | null, msg: string): string {
  const hasData = liveDataContext.length > 0;
  const ctx = hasData ? `\n\nWorkforce data snapshot:\n${liveDataContext}\n\n` : "\n\n";

  switch (intent) {
    case "company_info":
    case "people_at_company":
      if (hasData) return `Here's what the workforce data shows for ${company ?? "that company"}:${ctx}Professionals there typically come from a mix of backgrounds as shown above. Use this to prep your "why this company" narrative — understanding who they hire and where those people came from tells you a lot about the culture and expectations.`;
      return `I couldn't find strong workforce data for ${company ?? "that company"} — it may be listed under a different name. Research their LinkedIn page and recent news to understand team composition. Want help with interview prep or role strategy instead?`;

    case "role_info":
    case "career_path":
      if (hasData) return `Here's what the workforce data shows for ${title ?? "that role"}:${ctx}The career backgrounds above tell you exactly what experience matters most. If you're targeting this role, the companies and prior titles listed are your clearest signals. Want to talk through how your background maps to this pathway?`;
      return `I didn't find specific workforce data for "${title ?? "that role"}" — it may be phrased differently in the dataset. Generally, look at LinkedIn profiles of people currently in the role and map their background. Want help preparing for an interview or understanding the skill requirements?`;

    case "interview_prep":
      return `For interview prep${company ? ` at ${company}` : ""}:${ctx}Know your stories cold — every major project should have a clear situation, what you did, and the measurable outcome. Research the company's last 12 months (products, funding, leadership) and weave that into your "why us" answer. Prepare 3 smart questions about team priorities and how success is measured. Practice out loud — at least 3 runs before the real thing. What specific role or question type do you want to work through?`;

    case "salary":
      return `Salary data isn't in the workforce dataset directly, but the role distribution data${hasData ? " above" : ""} gives useful context. Cross-reference Levels.fyi, Glassdoor, and Blind for your specific title and market. Always anchor your negotiation after receiving the offer, not before — most companies have 10–20% flex above the initial number. Want help benchmarking a specific role?`;

    case "resume":
      return `A strong resume passes ATS screening, tells a clear story, and shows measurable impact. Mirror the exact language from the job posting. Every bullet should answer "so what?" — not "led a team" but "led a 6-person team that shipped X, reducing Y by 40%." Keep it one page unless you have 10+ years of experience. What role are you targeting?`;

    case "job_search":
      return `${hasData ? `Workforce data for "${title ?? "this role"}":${ctx}` : ""}Apply within the first 48 hours of a posting — the first wave of applicants gets a disproportionate share of interviews. Warm introductions outperform cold applications by roughly 4:1. Focus on second-degree LinkedIn connections at your target companies and ask for intros, not referrals. What role or company should we focus on?`;

    case "hiring_trends":
      return `${hasData ? `Current workforce patterns for "${title ?? "this space"}":${ctx}` : ""}The strongest demand right now is in AI-adjacent roles, mid-stage startups (Series B–D), and technical modernisation in finance and healthcare. Pure software engineering demand has stabilised since 2023. Candidates who combine domain expertise with technical skill are winning consistently. What market are you tracking?`;

    default:
      return "I can help with company research, role analysis, interview prep, salary guidance, and job search strategy — all grounded in real workforce data from LiveData Technologies. What are you working on?";
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { messages?: unknown; userMessage?: unknown; userContext?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const history: ChatMessage[]  = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) return NextResponse.json({ error: "No message" }, { status: 400 });

  // User profile context (job history, saved roles, target role/company)
  const userCtx: UserContext | null = body.userContext && typeof body.userContext === "object"
    ? body.userContext as UserContext
    : null;

  // Prefer user's target company/role over extracted entities when available
  const intent  = detectIntent(userMessage);
  const company = extractCompany(userMessage) ?? userCtx?.targetCompany ?? null;
  const title   = extractTitle(userMessage)   ?? userCtx?.targetRole   ?? null;

  // Fetch LiveData context + check Ollama in parallel
  const [liveDataContext, ollamaReady] = await Promise.all([
    buildLiveDataContext(intent, company, title),
    isOllamaAvailable(),
  ]);

  if (ollamaReady) {
    const streamed = await streamOllama(buildSystemPrompt(liveDataContext, userCtx), history, userMessage, intent);
    if (streamed) return streamed;
  }

  // Fallback: structured response using real LiveData data (non-streaming JSON)
  const reply = fallbackReply(intent, liveDataContext, company, title, userMessage);
  return NextResponse.json({ reply });
}
