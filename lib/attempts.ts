/**
 * Interview attempts stored in localStorage. "Attempted" tab shows these; user can review transcript and notes per question per company.
 */

export interface QuestionScoreAttempt {
  questionIndex: number;
  eyeContactScore: number;
  toneScore: number;
  responseScore: number;
  speakingTimeRatio: number;
  timeUsedMs: number;
}

export interface InterviewAttempt {
  id: string;
  company: string;
  role: string;
  date: string; // ISO
  interviewType: "behavioral" | "technical";
  questions: string[];
  transcripts: string[];
  scores: QuestionScoreAttempt[];
}

const STORAGE_KEY = "mock-interview-attempts";

function getStored(): InterviewAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValidAttempt) : [];
  } catch {
    return [];
  }
}

function isValidAttempt(x: unknown): x is InterviewAttempt {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "company" in x &&
    "role" in x &&
    "date" in x &&
    "interviewType" in x &&
    "questions" in x &&
    "transcripts" in x &&
    "scores" in x &&
    Array.isArray((x as InterviewAttempt).questions) &&
    Array.isArray((x as InterviewAttempt).transcripts) &&
    Array.isArray((x as InterviewAttempt).scores)
  );
}

function persist(list: InterviewAttempt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    //
  }
}

const RECENT_MS = 2 * 60 * 1000; // 2 minutes

export function saveAttempt(attempt: Omit<InterviewAttempt, "id" | "date">): void {
  const list = getStored();
  const now = Date.now();
  const recent = list.some(
    (a) =>
      a.company === attempt.company &&
      a.role === attempt.role &&
      now - new Date(a.date).getTime() < RECENT_MS
  );
  if (recent) return; // avoid duplicate on results refresh
  const withMeta: InterviewAttempt = {
    ...attempt,
    id: `attempt-${now}-${Math.random().toString(36).slice(2, 9)}`,
    date: new Date().toISOString(),
  };
  list.unshift(withMeta);
  if (list.length > 100) list.length = 100;
  persist(list);
}

export function getAttemptsByCompany(company: string): InterviewAttempt[] {
  return getStored().filter((a) => a.company === company);
}

export function getAllAttempts(): InterviewAttempt[] {
  return getStored();
}

export function getAttempt(id: string): InterviewAttempt | null {
  return getStored().find((a) => a.id === id) ?? null;
}

export function getCompaniesWithAttempts(): string[] {
  const set = new Set(getStored().map((a) => a.company).filter(Boolean));
  return Array.from(set).sort();
}
