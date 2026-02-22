"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { InterviewRoom } from "@/components/InterviewRoom";
import type { JobFunction } from "@/lib/livedata-types";
import { getQuestionsForFunction, getQuestionsForInterview } from "@/lib/behavioral-questions";

function InterviewContent() {
  const searchParams = useSearchParams();
  const role = searchParams?.get("role") ?? "Software Engineer";
  const company = searchParams?.get("company") ?? "";
  const fn = (searchParams?.get("function") ?? "engineering") as JobFunction;
  const questions = company
    ? getQuestionsForInterview(company, role, fn)
    : getQuestionsForFunction(fn);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 w-full p-4 md:p-5 gap-3.5">
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {company && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/logo?company=${encodeURIComponent(company)}`}
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <h1 className="text-lg font-semibold text-white truncate">
              Mock Interview{role ? ` | ${role}` : ""}
            </h1>
          </div>
          <Link
            href="/prepare"
            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Exit
          </Link>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <InterviewRoom company={company} role={role} questions={questions} />
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
