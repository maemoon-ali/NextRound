import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

  if (!openai) {
    return NextResponse.json(
      {
        overall: "needs_work",
        summary: "Set OPENAI_API_KEY to enable transcript analysis.",
        overall_score: 0.5,
        per_question: [],
      },
      { status: 200 }
    );
  }

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

  function parseScore(text: string): number {
    const match = text.match(/\bSCORE:\s*(\d{1,3})\b/i) ?? text.match(/(\d{1,3})\s*\/\s*100/);
    if (match) {
      const n = Math.min(100, Math.max(0, parseInt(match[1], 10)));
      return n / 100;
    }
    if (/\b(strong|excellent|great)\b/i.test(text)) return 0.85;
    if (/\b(weak|poor|bad)\b/i.test(text)) return 0.35;
    return 0.6;
  }

  const per_question: { question_index: number; question: string; transcript: string; feedback: string; score: number }[] = [];

  for (let i = 0; i < Math.min(questions.length, transcripts.length); i++) {
    const q = questions[i] ?? "";
    const t = transcripts[i] ?? "";
    try {
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `You are an interview coach. Score this behavioral interview answer using ONLY the candidate's spoken transcript. Do not guess; base the score strictly on what they said.

Question: ${q}
Candidate's spoken response (transcript): ${t || "(no speech captured)"}

Evaluate: relevance to the question, use of concrete examples (STAR), structure and clarity, and depth of answer. Give 1-2 sentences of specific feedback. Then on a new line write exactly: SCORE: N
where N is 0-100: 0-25=no/empty answer or off-topic, 26-49=weak (vague, no examples), 50-69=adequate, 70-84=strong (clear, relevant, some structure), 85-100=excellent (concrete examples, clear structure, highly relevant).`,
          },
        ],
        max_tokens: 220,
      });
      const text = (r.choices[0]?.message?.content ?? "").trim();
      const score = parseScore(text);
      const feedback = text.replace(/\n?\s*SCORE:\s*\d+\s*$/i, "").trim();
      per_question.push({ question_index: i, question: q, transcript: t, feedback, score });
    } catch (e) {
      per_question.push({
        question_index: i,
        question: q,
        transcript: t,
        feedback: `Analysis unavailable: ${e instanceof Error ? e.message : "error"}`,
        score: 0.5,
      });
    }
  }

  const qaText = questions
    .map((q, i) => `Q: ${q}\nA: ${transcripts[i] ?? "(none)"}`)
    .join("\n\n");

  let summary: string;
  let overallScoreNum: number;
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are an interview coach. Score the overall interview using ONLY the candidate's spoken answers (transcripts) below. Base the score strictly on content: relevance, examples, structure, and clarity across all answers.

Interview Q&As (candidate's words only):
${qaText}

In 2-4 sentences give specific, actionable feedback on their responses. Then on a new line write exactly: SCORE: N
where N is 0-100 (overall quality of the spoken answers: 0-25=poor/none, 26-49=weak, 50-69=adequate, 70-84=strong, 85-100=excellent).`,
        },
      ],
      max_tokens: 280,
    });
    const raw = (r.choices[0]?.message?.content ?? "").trim();
    overallScoreNum = parseScore(raw);
    summary = raw.replace(/\n?\s*SCORE:\s*\d+\s*$/i, "").trim();
  } catch {
    summary = "Could not generate overall summary.";
    overallScoreNum = per_question.length > 0
      ? per_question.reduce((a, x) => a + x.score, 0) / per_question.length
      : 0.5;
  }

  const summaryLower = summary.toLowerCase();
  const overall =
    overallScoreNum >= 0.65 ? "good" : overallScoreNum >= 0.4 ? "needs_work" : "poor";

  return NextResponse.json({
    overall,
    summary,
    overall_score: overallScoreNum,
    per_question,
  });
}
