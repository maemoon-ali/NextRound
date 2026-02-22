#!/usr/bin/env python3
"""
Analyze mock interview transcripts using an LLM.
Run after: pip install rapidfireai && rapidfireai init (optional).
Usage: echo '<json>' | python analyze_interview.py
   or: python analyze_interview.py < interview_results.json
Input JSON: {"questions": ["Q1?", "Q2?"], "transcripts": ["answer1", "answer2"]}
Output JSON: {"overall": "good|needs_work|poor", "summary": "...", "per_question": [...]}
"""

import json
import os
import sys
from openai import OpenAI


def analyze_with_llm(questions: list[str], transcripts: list[str]) -> dict:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    if not questions or not transcripts:
        return {
            "overall": "no_data",
            "summary": "No interview responses to analyze.",
            "per_question": [],
        }
    per_question = []
    for i, (q, t) in enumerate(zip(questions, transcripts)):
        prompt = f"""You are an interview coach. Evaluate this behavioral interview response.

Question: {q}
Candidate response (transcript): {t or "(no speech captured)"}

In 1-2 sentences: Is this response strong, okay, or weak? Be specific (e.g. structure, examples, clarity, relevance)."""
        try:
            r = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
            )
            text = (r.choices[0].message.content or "").strip()
        except Exception as e:
            text = f"Analysis unavailable: {e}"
        per_question.append({"question_index": i, "question": q, "transcript": t, "feedback": text})
    # Overall summary
    qa_text = "\n\n".join(
        f"Q: {q}\nA: {t or '(none)'}" for q, t in zip(questions, transcripts)
    )
    summary_prompt = f"""You are an interview coach. Here are the interview Q&As:

{qa_text}

In 2-4 sentences: Overall, is this interview performance good, needs work, or poor? Give specific, actionable feedback."""
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": summary_prompt}],
            max_tokens=250,
        )
        summary = (r.choices[0].message.content or "").strip()
    except Exception as e:
        summary = str(e)
    if "good" in summary.lower() and "poor" not in summary.lower():
        overall = "good"
    elif "poor" in summary.lower() or "weak" in summary.lower():
        overall = "poor"
    else:
        overall = "needs_work"
    return {"overall": overall, "summary": summary, "per_question": per_question}


def main() -> None:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}))
        sys.exit(1)
    questions = data.get("questions") or []
    transcripts = data.get("transcripts") or []
    if not os.environ.get("OPENAI_API_KEY"):
        out = {
            "overall": "needs_work",
            "summary": "Set OPENAI_API_KEY to enable transcript analysis.",
            "per_question": [],
        }
    else:
        out = analyze_with_llm(questions, transcripts)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
