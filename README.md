# Mock Interview Prep App

A practice interview app that uses **LiveDataTechnologies**–style workforce data ([People Data Dictionary](https://docs.gotlivedata.com/docs/notion-dd-preview)) to match your job history to similar professionals and suggest a role to practice for. You get a behavioral mock interview with webcam and microphone, plus scored metrics and visualizations.

## Features

- **Job history input** – Enter company, years, salary, role type (intern, full-time, part-time, etc.), and title. Data shape aligns with LiveDataTechnologies job level, function, and company fields.
- **Similarity matching** – Your history is compared to a mock workforce database (schema: `level`, `function`, `location_details`, `started_at_details`). We find people with similar roles/companies and use their **current** jobs as suggested next roles.
- **Mock interview** – 5 behavioral questions for the suggested job, 2 minutes per answer. Uses your **webcam** and **microphone**.
- **Scoring** – Tone and speaking time are derived from live audio; eye contact and response quality use the same pipeline (CV-based eye contact can be wired to MediaPipe/Face Mesh later).
- **Results** – Overall score, radar chart of metrics, per-question bar charts, and time-per-question view.

## Data schema (LiveDataTechnologies–aligned)

- **Jobs**: `title`, `level`, `function`, `company` (name, industry, etc.), `location`, `location_details`, `started_at`, `started_at_details` (confidence).
- **People**: `job_history` + `current_position` (where they work now).

Mock data in `lib/mock-livedata.ts` follows this schema; you can swap in the real [LiveDataTechnologies People API](https://docs.gotlivedata.com/docs/people-api) when you have credentials.

## Run locally

```bash
cd mock-interview-prep-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow camera and microphone when starting the interview.

## Tech

- **Next.js 14** (App Router), **React**, **TypeScript**
- **Tailwind CSS**
- **Recharts** for result visualizations
- **Web Audio API** for tone/speaking analysis
