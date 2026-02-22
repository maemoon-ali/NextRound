"use client";

import { useState, useRef } from "react";
import type { UserJobEntry, RoleType } from "@/lib/livedata-types";

const ROLE_TYPES: RoleType[] = ["intern", "full-time", "part-time", "contract", "freelance"];

const defaultEntry: UserJobEntry = {
  company_name: "",
  years_employment: 0,
  salary: 0,
  role_type: "full-time",
  title: "",
  location: "",
};

interface JobHistoryFormProps {
  onSubmit: (jobs: UserJobEntry[]) => void;
  loading: boolean;
  variant?: "default" | "vibrant";
}

const inputBase =
  "mt-1 w-full rounded-lg px-3 py-2 text-white focus:outline-none";
const inputDefault =
  "border border-zinc-600 bg-zinc-800 placeholder-zinc-500 focus:border-emerald-500";
const inputVibrant =
  "border-2 border-emerald-500/30 bg-zinc-800/80 placeholder-zinc-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

export function JobHistoryForm({ onSubmit, loading, variant = "default" }: JobHistoryFormProps) {
  const isVibrant = variant === "vibrant";
  const cardClass = isVibrant
    ? "rounded-xl border-2 border-emerald-500/25 bg-gradient-to-br from-zinc-800/50 to-emerald-950/20 p-4 space-y-4"
    : "rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 space-y-4";
  const labelClass = isVibrant ? "text-xs text-emerald-200/90" : "text-xs text-zinc-500";
  const inputClass = `${inputBase} ${isVibrant ? inputVibrant : inputDefault}`;
  const [entries, setEntries] = useState<UserJobEntry[]>([{ ...defaultEntry }]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addJob() {
    setEntries((e) => [...e, { ...defaultEntry }]);
    setValidationError(null);
  }

  function removeJob(i: number) {
    if (entries.length <= 1) return;
    setEntries((e) => e.filter((_, j) => j !== i));
    setValidationError(null);
  }

  function update(i: number, field: keyof UserJobEntry, value: string | number) {
    setEntries((prev) => {
      const next = prev.map((entry, j) =>
        j !== i ? entry : { ...entry, [field]: value }
      );
      return next;
    });
    setValidationError(null);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploadStatus("uploading");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data?.error ?? "Failed to parse resume.");
        setUploadStatus("error");
        return;
      }
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (jobs.length === 0) {
        setUploadError("No job history could be extracted. Try adding job titles and companies to your resume.");
        setUploadStatus("error");
        return;
      }
      setEntries(jobs.map((j: UserJobEntry) => ({ ...defaultEntry, ...j })));
      setUploadStatus("done");
      setValidationError(null);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setUploadStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const valid = entries.filter(
      (x) =>
        ((x.company_name ?? "").trim().length > 0 || (x.title ?? "").trim().length > 0) &&
        (typeof x.years_employment === "number" ? x.years_employment >= 0 : true)
    );
    if (valid.length === 0) {
      setValidationError("Please enter at least a job title or company name for one role.");
      return;
    }
    onSubmit(valid);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={handleResumeUpload}
          className="hidden"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadStatus === "uploading"}
          className={
            isVibrant
              ? "rounded-lg border-2 border-emerald-500/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              : "rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          }
        >
          {uploadStatus === "uploading" ? "Parsing…" : "Upload Resume"}
        </button>
        {uploadStatus === "done" && (
          <span className="text-sm text-emerald-400">Job history filled from resume.</span>
        )}
      </div>
      {uploadError && (
        <p className="text-amber-400 text-sm" role="alert">
          {uploadError}
        </p>
      )}
      {validationError && (
        <p className="text-amber-400 text-sm" role="alert">
          {validationError}
        </p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${isVibrant ? "text-emerald-200" : "text-zinc-300"}`}>
              Role {i + 1}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeJob(i)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Job title</span>
              <input
                type="text"
                value={entry.title ?? ""}
                onChange={(e) => update(i, "title", e.target.value)}
                className={inputClass}
                placeholder="e.g. Software Engineer"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Company name</span>
              <input
                type="text"
                value={entry.company_name ?? ""}
                onChange={(e) => update(i, "company_name", e.target.value)}
                className={inputClass}
                placeholder="e.g. Stripe"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Years of employment</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={entry.years_employment === 0 ? "" : (entry.years_employment ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  update(i, "years_employment", v === "" ? 0 : parseFloat(v) || 0);
                }}
                className={inputClass}
                placeholder="2.5"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Salary (annual USD)</span>
              <input
                type="number"
                min={0}
                value={entry.salary === 0 ? "" : (entry.salary ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  update(i, "salary", v === "" ? 0 : parseInt(v, 10) || 0);
                }}
                className={inputClass}
                placeholder="120000"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Role type</span>
              <select
                value={entry.role_type ?? "full-time"}
                onChange={(e) => update(i, "role_type", e.target.value as RoleType)}
                className={inputClass}
              >
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Location (optional)</span>
              <input
                type="text"
                value={entry.location ?? ""}
                onChange={(e) => update(i, "location", e.target.value)}
                className={inputClass}
                placeholder="San Francisco, CA"
              />
            </label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addJob}
          className={
            isVibrant
              ? "rounded-lg border-2 border-emerald-500/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
              : "rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          }
        >
          + Add another role
        </button>
        <button
          type="submit"
          disabled={loading}
          className={
            isVibrant
              ? "rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              : "rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          }
        >
          {loading ? "Matching…" : "Find similar roles & start practice"}
        </button>
      </div>
    </form>
  );
}
