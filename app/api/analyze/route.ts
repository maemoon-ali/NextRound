import { NextResponse } from "next/server";

type OverallLabel = "good" | "needs_work" | "poor" | "no_data";

type PerQuestionAnalysis = {
  question_index: number;
  question: string;
  transcript: string;
  feedback: string;
  score: number; // 0..1
};

type AnalyzeResponse = {
  overall: OverallLabel;
  summary: string;
  overall_score: number; // 0..1
  per_question: PerQuestionAnalysis[];
};

interface SpeechPatterns {
  fillerWords: { word: string; count: number }[];
  fillerWordCount: number;
  hasStuttering: boolean;
  pauseCount: number;
  repeatedWords: { word: string; count: number }[];
  speechQuality: "excellent" | "good" | "needs_improvement" | "poor";
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  // Remove ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function safeJsonParseObject(text: string): unknown {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to salvage first {...} block
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error("Invalid JSON from local LLM.");
  }
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(t);
  }
}

let ollamaLastCheckAt = 0;
let ollamaCachedAvailable: boolean | null = null;
async function isOllamaAvailable(): Promise<boolean> {
  const now = Date.now();
  if (ollamaCachedAvailable != null && now - ollamaLastCheckAt < 30_000) {
    return ollamaCachedAvailable;
  }
  ollamaLastCheckAt = now;
  try {
    // /api/tags is tiny and fast if Ollama is up
    await fetchJsonWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, { method: "GET" }, 900);
    ollamaCachedAvailable = true;
    return true;
  } catch {
    ollamaCachedAvailable = false;
    return false;
  }
}

function looksTechnical(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("two sum") ||
    q.includes("algorithm") ||
    q.includes("time complexity") ||
    q.includes("space complexity") ||
    q.includes("big o") ||
    q.includes("leetcode") ||
    q.includes("code") ||
    q.includes("implement") ||
    q.includes("write a function") ||
    q.includes("debug")
  );
}

async function analyzeWithLocalLLM(params: {
  questions: string[];
  transcripts: string[];
}): Promise<AnalyzeResponse> {
  const { questions, transcripts } = params;

  const qa = questions.slice(0, transcripts.length).map((question, i) => {
    const transcript = transcripts[i] ?? "";
    const technical = looksTechnical(question);
    const speech = analyzeSpeechPatterns(transcript);
    const elements = !technical ? checkResponseElements(transcript, question) : null;
    return {
      question_index: i,
      question,
      transcript,
      is_technical: technical,
      heuristic: {
        missing_elements: elements?.missingElements ?? [],
        has_situation: elements?.hasSituation ?? null,
        has_task: elements?.hasTask ?? null,
        has_action: elements?.hasAction ?? null,
        has_result: elements?.hasResult ?? null,
        has_concrete_details: elements?.hasConcreteDetails ?? null,
        filler_word_count: speech.fillerWordCount,
        filler_words: speech.fillerWords,
        pause_count: speech.pauseCount,
        has_stuttering: speech.hasStuttering,
        repeated_words: speech.repeatedWords,
      },
    };
  });

  const system = [
    "You are a strict interview coach.",
    "You will receive interview questions and the candidate's transcript answers.",
    "Your job is to analyze ONLY what is in the transcript and identify concrete gaps (what is missing).",
    "Return STRICT JSON ONLY. No markdown, no code fences, no extra keys.",
    "Scoring: use score in [0,1]. 0=empty/off-topic; 0.5=okay but missing key elements; 0.8=strong; 0.95=excellent.",
    "For behavioral: evaluate STAR (Situation/Task/Action/Result), specificity, relevance, and outcomes/metrics.",
    "For technical: evaluate problem restatement, approach, reasoning, edge cases, complexity, and verification/testing.",
    "Also comment on delivery using the provided counts: filler words (um/uh), pauses, stuttering/repetitions.",
    "",
    "Output schema:",
    "{",
    '  "overall": "good" | "needs_work" | "poor",',
    '  "overall_score": number,',
    '  "summary": string,',
    '  "per_question": [',
    "     {",
    '       "question_index": number,',
    '       "score": number,',
    '       "feedback": string',
    "     }",
    "  ]",
    "}",
  ].join("\n");

  const user = [
    "Analyze the following Q&A list. Be specific about what was missing and reference concrete transcript evidence.",
    "If the heuristic says something is missing, verify it against the transcript and refine it (don’t blindly repeat).",
    "",
    "DATA:",
    JSON.stringify({ qa }, null, 2),
  ].join("\n");

  const payload = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options: {
      temperature: 0.2,
      num_predict: 900,
    },
  };

  const raw = await fetchJsonWithTimeout(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    25_000
  );

  const content =
    typeof raw === "object" &&
    raw != null &&
    "message" in raw &&
    typeof (raw as any).message?.content === "string"
      ? String((raw as any).message.content)
      : "";

  const parsed = safeJsonParseObject(content);
  if (typeof parsed !== "object" || parsed == null) {
    throw new Error("Local LLM returned non-object JSON.");
  }

  const obj = parsed as any;
  const per = Array.isArray(obj.per_question) ? obj.per_question : [];

  const per_question: PerQuestionAnalysis[] = qa.map((x) => {
    const from = per.find((p: any) => p && Number(p.question_index) === x.question_index) ?? {};
    const score = clamp01(Number(from.score ?? 0));
    const feedback = typeof from.feedback === "string" ? from.feedback.trim() : "";
    return {
      question_index: x.question_index,
      question: x.question,
      transcript: x.transcript,
      score: score || 0,
      feedback: feedback || "No feedback generated.",
    };
  });

  const overall_score = clamp01(Number(obj.overall_score ?? (per_question.reduce((a, p) => a + p.score, 0) / Math.max(1, per_question.length))));
  const overall: OverallLabel =
    overall_score >= 0.65 ? "good" : overall_score >= 0.4 ? "needs_work" : "poor";
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";

  return {
    overall,
    overall_score,
    summary: summary || "Local LLM summary unavailable.",
    per_question,
  };
}

/**
 * Checks what elements are present or missing in a behavioral interview response.
 */
function checkResponseElements(transcript: string, question: string): {
  hasSituation: boolean;
  hasTask: boolean;
  hasAction: boolean;
  hasResult: boolean;
  hasConcreteDetails: boolean;
  hasRelevance: boolean;
  missingElements: string[];
} {
  const text = transcript.toLowerCase();
  const questionLower = question.toLowerCase();
  
  // Check for STAR components
  const situationKeywords = ["when", "where", "who", "situation", "context", "background", "at", "during", "while", "in"];
  const taskKeywords = ["goal", "task", "objective", "needed to", "had to", "responsible", "challenge", "problem"];
  const actionKeywords = ["i did", "i decided", "i took", "i implemented", "i created", "i worked", "i communicated", "i led", "i organized", "action"];
  const resultKeywords = ["result", "outcome", "impact", "achieved", "improved", "increased", "decreased", "solved", "delivered", "metric", "percent", "%", "number"];
  
  const hasSituation = situationKeywords.some(kw => text.includes(kw)) || 
    /\b(in|at|during|while)\s+\d{4}\b/.test(text) || // dates
    /\b(company|team|project|department)\b/.test(text);
  
  const hasTask = taskKeywords.some(kw => text.includes(kw)) ||
    /\b(goal|objective|needed|required)\b/.test(text);
  
  const hasAction = actionKeywords.some(kw => text.includes(kw)) ||
    /\b(i|we)\s+(did|made|created|built|implemented|developed|worked|collaborated|communicated|decided|chose)\b/.test(text);
  
  const hasResult = resultKeywords.some(kw => text.includes(kw)) ||
    /\d+%/.test(text) || // percentages
    /\b(increased|decreased|improved|achieved|solved|delivered|completed|successful)\b/.test(text);
  
  // Check for concrete details (numbers, timeframes, names)
  const hasConcreteDetails = 
    /\d+/.test(text) || // any numbers
    /\b(week|month|year|day|hour|minute)\b/.test(text) || // timeframes
    /\b(team|company|project|department|manager|colleague)\b/.test(text); // specific references
  
  // Check relevance to question
  const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
  const hasRelevance = questionWords.some(qw => text.includes(qw)) || text.length > 50;
  
  const missingElements: string[] = [];
  if (!hasSituation) missingElements.push("Situation/context (when, where, who)");
  if (!hasTask) missingElements.push("Task/goal/objective");
  if (!hasAction) missingElements.push("Action (what you did)");
  if (!hasResult) missingElements.push("Result/outcome/metrics");
  if (!hasConcreteDetails) missingElements.push("Concrete details (numbers, timeframes, names)");
  
  return {
    hasSituation,
    hasTask,
    hasAction,
    hasResult,
    hasConcreteDetails,
    hasRelevance,
    missingElements,
  };
}

/**
 * Analyzes transcript for speech patterns: filler words, stuttering, pauses, and repeated words.
 */
function analyzeSpeechPatterns(transcript: string): SpeechPatterns {
  const text = transcript.trim().toLowerCase();
  if (!text) {
    return {
      fillerWords: [],
      fillerWordCount: 0,
      hasStuttering: false,
      pauseCount: 0,
      repeatedWords: [],
      speechQuality: "poor",
    };
  }

  // Common filler words
  const fillerWordSet = new Set([
    "um", "uh", "er", "ah", "oh", "hmm", "like", "you know", "so", "well", "actually",
    "basically", "literally", "kind of", "sort of", "i mean", "you see"
  ]);

  // Count filler words
  const words = text.split(/\s+/).filter(Boolean);
  const fillerWords: { word: string; count: number }[] = [];
  const fillerCounts = new Map<string, number>();
  
  words.forEach((word) => {
    const cleanWord = word.replace(/[^a-z]/g, "");
    if (fillerWordSet.has(cleanWord)) {
      fillerCounts.set(cleanWord, (fillerCounts.get(cleanWord) || 0) + 1);
    }
  });
  
  fillerCounts.forEach((count, word) => {
    fillerWords.push({ word, count });
  });
  fillerWords.sort((a, b) => b.count - a.count);
  const fillerWordCount = Array.from(fillerCounts.values()).reduce((a, b) => a + b, 0);

  // Detect stuttering: repeated syllables or words (e.g., "I-I-I", "the-the", "um-um-um")
  const stutterPattern = /(\b\w{1,4}\b)(\s+\1\b){2,}/gi;
  const hasStuttering = stutterPattern.test(transcript);

  // Detect pauses: look for patterns like "(pause)", "(long pause)", or multiple consecutive spaces/punctuation
  const pausePattern = /\(long pause\)|\(pause\)|\.\.\.|\s{3,}/gi;
  const pauseMatches = transcript.match(pausePattern);
  const pauseCount = pauseMatches ? pauseMatches.length : 0;

  // Detect repeated words (potential stuttering or hesitation)
  const repeatedWords: { word: string; count: number }[] = [];
  const wordSequence = words;
  const repeats = new Map<string, number>();
  
  for (let i = 0; i < wordSequence.length - 1; i++) {
    const word = wordSequence[i].replace(/[^a-z]/g, "");
    const nextWord = wordSequence[i + 1].replace(/[^a-z]/g, "");
    if (word === nextWord && word.length > 0 && !fillerWordSet.has(word)) {
      const key = word;
      repeats.set(key, (repeats.get(key) || 0) + 1);
    }
  }
  
  repeats.forEach((count, word) => {
    if (count >= 2) {
      repeatedWords.push({ word, count });
    }
  });
  repeatedWords.sort((a, b) => b.count - a.count);

  // Determine speech quality
  const totalWords = words.length;
  const fillerRatio = totalWords > 0 ? fillerWordCount / totalWords : 0;
  let speechQuality: SpeechPatterns["speechQuality"];
  
  if (fillerRatio > 0.15 || hasStuttering || pauseCount > 3) {
    speechQuality = "poor";
  } else if (fillerRatio > 0.08 || pauseCount > 1) {
    speechQuality = "needs_improvement";
  } else if (fillerRatio > 0.03) {
    speechQuality = "good";
  } else {
    speechQuality = "excellent";
  }

  return {
    fillerWords,
    fillerWordCount,
    hasStuttering,
    pauseCount,
    repeatedWords,
    speechQuality,
  };
}

/**
 * Generates detailed feedback based on analysis of transcript, question, and detected patterns.
 */
function generateDetailedFeedback(
  transcript: string,
  question: string,
  responseElements: ReturnType<typeof checkResponseElements>,
  speechPatterns: SpeechPatterns,
  isBehavioral: boolean
): { feedback: string; score: number } {
  const text = transcript.trim();
  if (!text || text.length < 10) {
    return {
      feedback: "No substantial response captured. Make sure to speak clearly and provide a complete answer.",
      score: 0.1,
    };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  
  // Build feedback sections
  const sections: string[] = [];
  
  // What was present
  const presentItems: string[] = [];
  if (responseElements.hasSituation) presentItems.push("Situation/context");
  if (responseElements.hasTask) presentItems.push("Task/goal");
  if (responseElements.hasAction) presentItems.push("Action steps");
  if (responseElements.hasResult) presentItems.push("Result/outcome");
  if (responseElements.hasConcreteDetails) presentItems.push("Concrete details (numbers/timeframes)");
  if (wordCount >= 50) presentItems.push("Adequate length");
  if (sentences >= 3) presentItems.push("Multiple sentences with structure");
  
  if (presentItems.length > 0) {
    sections.push(`What was present: ${presentItems.join(", ")}.`);
  } else {
    sections.push("What was present: Very minimal response with little structure.");
  }
  
  // What was missing
  const missingItems: string[] = [];
  if (!responseElements.hasSituation) missingItems.push("Situation context (when/where/who - e.g., 'At my previous company in 2023, my team and I...')");
  if (!responseElements.hasTask) missingItems.push("Task/goal (what you needed to accomplish - e.g., 'We needed to improve performance by 50%')");
  if (!responseElements.hasAction) missingItems.push("Action steps (what you specifically did - e.g., 'I implemented a caching layer and coordinated with the backend team')");
  if (!responseElements.hasResult) missingItems.push("Result/outcome with metrics (e.g., 'We achieved a 40% improvement and reduced load time by 2 seconds')");
  if (!responseElements.hasConcreteDetails) missingItems.push("Concrete details (numbers, percentages, timeframes, team names, project names)");
  if (wordCount < 50) missingItems.push("More detail and depth (aim for 50+ words)");
  if (sentences < 3) missingItems.push("Better structure with multiple sentences");
  
  if (missingItems.length > 0) {
    sections.push(`What was missing: ${missingItems.join("; ")}.`);
  }
  
  // Speech delivery issues
  const deliveryIssues: string[] = [];
  if (speechPatterns.fillerWordCount > 0) {
    const topFillers = speechPatterns.fillerWords.slice(0, 3).map(f => `${f.word} (${f.count}x)`).join(", ");
    deliveryIssues.push(`${speechPatterns.fillerWordCount} filler words detected (${topFillers})`);
  }
  if (speechPatterns.hasStuttering) {
    deliveryIssues.push("Stuttering detected (repeated words/syllables)");
  }
  if (speechPatterns.pauseCount > 0) {
    deliveryIssues.push(`${speechPatterns.pauseCount} long pause(s) detected`);
  }
  if (speechPatterns.repeatedWords.length > 0) {
    const topRepeats = speechPatterns.repeatedWords.slice(0, 2).map(r => `${r.word} (${r.count}x)`).join(", ");
    deliveryIssues.push(`Repeated words: ${topRepeats}`);
  }
  
  if (deliveryIssues.length > 0) {
    sections.push(`Speech delivery: ${deliveryIssues.join("; ")}. Practice speaking more smoothly and reduce filler words.`);
  } else {
    sections.push("Speech delivery: Good fluency with minimal filler words and pauses.");
  }
  
  // Specific improvements
  const improvements: string[] = [];
  if (!responseElements.hasSituation && isBehavioral) {
    improvements.push("Start with context: 'At [company] in [timeframe], I was working on [project]...'");
  }
  if (!responseElements.hasTask && isBehavioral) {
    improvements.push("State the goal: 'The challenge was to [specific objective]...'");
  }
  if (!responseElements.hasAction && isBehavioral) {
    improvements.push("Explain your actions: 'I [specific action], then [next step], and [final step]...'");
  }
  if (!responseElements.hasResult && isBehavioral) {
    improvements.push("Include results with metrics: 'As a result, we [outcome] and [metric/impact]...'");
  }
  if (!responseElements.hasConcreteDetails) {
    improvements.push("Add specific numbers, timeframes, or names to make your answer more credible");
  }
  if (wordCount < 50) {
    improvements.push("Expand your answer with more detail - aim for 50-100 words minimum");
  }
  if (speechPatterns.fillerWordCount > 5) {
    improvements.push("Practice pausing instead of saying 'um' or 'uh' - take a breath and think");
  }
  
  if (improvements.length > 0) {
    sections.push(`Specific improvements: ${improvements.join("; ")}.`);
  }
  
  // Calculate score
  let score = 0.5; // base score
  
  // Content completeness (60% of score)
  const starComponents = [responseElements.hasSituation, responseElements.hasTask, responseElements.hasAction, responseElements.hasResult].filter(Boolean).length;
  score += (starComponents / 4) * 0.3; // up to 0.3 points for STAR
  if (responseElements.hasConcreteDetails) score += 0.1;
  if (wordCount >= 50) score += 0.1;
  if (wordCount >= 100) score += 0.1;
  
  // Speech quality (40% of score)
  const fillerRatio = wordCount > 0 ? speechPatterns.fillerWordCount / wordCount : 0;
  if (fillerRatio < 0.03) score += 0.15; // excellent
  else if (fillerRatio < 0.08) score += 0.1; // good
  else if (fillerRatio < 0.15) score += 0.05; // needs improvement
  
  if (!speechPatterns.hasStuttering) score += 0.1;
  if (speechPatterns.pauseCount <= 1) score += 0.05;
  
  score = Math.max(0.1, Math.min(1.0, score));
  
  const feedback = sections.join("\n\n");
  
  return { feedback, score };
}

export async function POST(request: Request) {
  let body: { questions?: unknown; transcripts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const questions = Array.isArray(body.questions)
    ? (body.questions as string[]).map((q) => String(q ?? ""))
    : [];
  const transcripts = Array.isArray(body.transcripts)
    ? (body.transcripts as string[]).map((t) => String(t ?? ""))
    : [];

  if (questions.length === 0 || transcripts.length === 0) {
    return NextResponse.json(
      {
        overall: "no_data",
        summary: "No interview responses to analyze.",
        overall_score: 0.5,
        per_question: [],
      },
      { status: 200 }
    );
  }

  // 1) Try local LLM (Ollama) if available (no API key).
  if (await isOllamaAvailable()) {
    try {
      const llm = await analyzeWithLocalLLM({ questions, transcripts });
      return NextResponse.json(llm);
    } catch {
      // Fall back to heuristic analysis below.
    }
  }

  // 2) Fallback: heuristic analysis (always available).
  const per_question: PerQuestionAnalysis[] = [];

  for (let i = 0; i < Math.min(questions.length, transcripts.length); i++) {
    const q = questions[i] ?? "";
    const t = transcripts[i] ?? "";
    
    // Analyze speech patterns
    const speechPatterns = analyzeSpeechPatterns(t);
    
    // Check what elements are missing from the response
    const isBehavioral = !q.toLowerCase().includes("code") && !q.toLowerCase().includes("algorithm") && !q.toLowerCase().includes("technical");
    const responseElements = isBehavioral ? checkResponseElements(t, q) : null;
    
    // Generate detailed feedback using local analysis
    const analysis = generateDetailedFeedback(t, q, responseElements || {
      hasSituation: false,
      hasTask: false,
      hasAction: false,
      hasResult: false,
      hasConcreteDetails: false,
      hasRelevance: false,
      missingElements: [],
    }, speechPatterns, isBehavioral);
    
    per_question.push({
      question_index: i,
      question: q,
      transcript: t,
      feedback: analysis.feedback,
      score: analysis.score,
    });
  }

  const qaText = questions
    .map((q, i) => `Q: ${q}\nA: ${transcripts[i] ?? "(none)"}`)
    .join("\n\n");

  // Generate overall summary from local analysis
  const allTranscripts = transcripts.join(" ");
  const overallSpeechPatterns = analyzeSpeechPatterns(allTranscripts);
  
  // Analyze missing elements across all questions
  const missingCounts = {
    situation: 0,
    task: 0,
    action: 0,
    result: 0,
    concreteDetails: 0,
  };
  
  per_question.forEach((pq) => {
    const isBehavioral = !pq.question.toLowerCase().includes("code") && 
                         !pq.question.toLowerCase().includes("algorithm") && 
                         !pq.question.toLowerCase().includes("technical");
    if (isBehavioral) {
      const elements = checkResponseElements(pq.transcript, pq.question);
      if (!elements.hasSituation) missingCounts.situation++;
      if (!elements.hasTask) missingCounts.task++;
      if (!elements.hasAction) missingCounts.action++;
      if (!elements.hasResult) missingCounts.result++;
      if (!elements.hasConcreteDetails) missingCounts.concreteDetails++;
    }
  });
  
  const totalQuestions = per_question.length;
  const summaryParts: string[] = [];
  
  // Missing elements summary
  const missingItems: string[] = [];
  if (missingCounts.situation > totalQuestions * 0.5) {
    missingItems.push(`Situation context missing in ${missingCounts.situation}/${totalQuestions} answers`);
  }
  if (missingCounts.task > totalQuestions * 0.5) {
    missingItems.push(`Task/goal missing in ${missingCounts.task}/${totalQuestions} answers`);
  }
  if (missingCounts.action > totalQuestions * 0.5) {
    missingItems.push(`Action steps missing in ${missingCounts.action}/${totalQuestions} answers`);
  }
  if (missingCounts.result > totalQuestions * 0.5) {
    missingItems.push(`Results/metrics missing in ${missingCounts.result}/${totalQuestions} answers`);
  }
  if (missingCounts.concreteDetails > totalQuestions * 0.5) {
    missingItems.push(`Concrete details (numbers/timeframes) missing in ${missingCounts.concreteDetails}/${totalQuestions} answers`);
  }
  
  if (missingItems.length > 0) {
    summaryParts.push(`Missing elements: ${missingItems.join("; ")}.`);
  }
  
  // Speech patterns summary
  const speechIssues: string[] = [];
  if (overallSpeechPatterns.fillerWordCount > 0) {
    speechIssues.push(`${overallSpeechPatterns.fillerWordCount} total filler words across all answers`);
  }
  if (overallSpeechPatterns.hasStuttering) {
    speechIssues.push("Stuttering patterns observed");
  }
  if (overallSpeechPatterns.pauseCount > 0) {
    speechIssues.push(`${overallSpeechPatterns.pauseCount} long pauses detected`);
  }
  
  if (speechIssues.length > 0) {
    summaryParts.push(`Speech delivery: ${speechIssues.join("; ")}. Practice reducing filler words and speaking more smoothly.`);
  } else {
    summaryParts.push("Speech delivery: Good fluency with minimal filler words.");
  }
  
  // Strengths
  const avgScore = per_question.reduce((a, x) => a + x.score, 0) / per_question.length;
  if (avgScore >= 0.7) {
    summaryParts.push("Strengths: You provided structured answers with good detail and clear communication.");
  } else if (avgScore >= 0.5) {
    summaryParts.push("Strengths: You demonstrated some structure and attempted to provide examples.");
  } else {
    summaryParts.push("Areas to focus: Work on providing more complete answers with all STAR components and concrete details.");
  }
  
  // Specific gaps
  const gapItems: string[] = [];
  if (missingCounts.situation >= totalQuestions * 0.6) {
    gapItems.push("Start answers with context (when/where/who)");
  }
  if (missingCounts.result >= totalQuestions * 0.6) {
    gapItems.push("Always include results with metrics or quantifiable outcomes");
  }
  if (missingCounts.concreteDetails >= totalQuestions * 0.6) {
    gapItems.push("Add specific numbers, percentages, timeframes, or names to make answers more credible");
  }
  if (overallSpeechPatterns.fillerWordCount > totalQuestions * 5) {
    gapItems.push("Practice pausing instead of using filler words - aim for fewer than 5 per answer");
  }
  
  if (gapItems.length > 0) {
    summaryParts.push(`Specific improvements: ${gapItems.join("; ")}.`);
  }
  
  const summary = summaryParts.join("\n\n");
  const overallScoreNum = per_question.length > 0
    ? per_question.reduce((a, x) => a + x.score, 0) / per_question.length
    : 0.5;

  const overall: OverallLabel =
    overallScoreNum >= 0.65 ? "good" : overallScoreNum >= 0.4 ? "needs_work" : "poor";

  return NextResponse.json({
    overall,
    summary,
    overall_score: overallScoreNum,
    per_question,
  });
}
