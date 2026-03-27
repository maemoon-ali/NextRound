"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { InterviewRoom } from "@/components/InterviewRoom";
import { InterviewSearch, type InterviewRole } from "@/components/InterviewSearch";
import { CompanyLogo } from "@/components/ui/company-logo";
import type { JobFunction } from "@/lib/livedata-types";
import { getQuestionsForFunction, getQuestionsForInterview } from "@/lib/behavioral-questions";

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole    = searchParams?.get("role") ?? "";
  const urlCompany = searchParams?.get("company") ?? "";
  const urlFn      = searchParams?.get("function") ?? "";

  const [selected, setSelected] = useState<InterviewRole | null>(
    urlCompany && urlRole
      ? { role: urlRole, company: urlCompany, domain: "", function: urlFn || "engineering", level: "" }
      : null
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Loading…</div>;
  }

  // ── Landing / search ──────────────────────────────────────────────────────
  if (!selected) {
    return <InterviewSearch type="behavioral" onSelect={setSelected} />;
  }

  // ── Interview room ────────────────────────────────────────────────────────
  const fn = (selected.function || "engineering") as JobFunction;
  const questions = selected.company
    ? getQuestionsForInterview(selected.company, selected.role, fn)
    : getQuestionsForFunction(fn);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 w-full p-4 md:p-5 gap-3.5">
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {selected.company && (
              <CompanyLogo name={selected.company} domain={selected.domain} size="h-10 w-10" />
            )}
            <h1 className="text-lg font-semibold text-white truncate">
              Mock Interview{selected.role ? ` | ${selected.role}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => router.push("/prepare?section=behavioral")}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              ← Search
            </button>
            <Link
              href="/prepare"
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Exit
            </Link>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <InterviewRoom company={selected.company} role={selected.role} questions={questions} />
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-zinc-400">
          Loading…
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
