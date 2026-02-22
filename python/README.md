# Interview transcript analysis (RapidFire AI)

This folder provides **data analysis for mock interview transcripts** using an LLM. You can run it locally with RapidFire AI or use the built-in analysis on the results page (which calls the Next.js API with the same logic).

## Setup

```bash
pip install rapidfireai
rapidfireai init
pip install -r requirements.txt
```

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your_key
```

## Run analysis locally

Pipe interview results JSON to the script:

```bash
# From a file
python analyze_interview.py < interview_results.json

# Or via stdin
echo '{"questions": ["Tell me about yourself."], "transcripts": ["I am a software engineer..."]}' | python analyze_interview.py
```

Input JSON format (same as stored in the app after an interview):

- `questions`: array of question strings
- `transcripts`: array of response transcript strings (one per question)

Output: JSON with `overall` (good | needs_work | poor), `summary`, and `per_question` feedback.

## Integration with the app

The **results page** in the Next.js app automatically calls `/api/analyze` with your stored questions and transcripts and displays the same overall + per-question analysis. Set `OPENAI_API_KEY` in your environment for the API route to run the analysis.
