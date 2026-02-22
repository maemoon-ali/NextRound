"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LandingPage() {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);
  const [exiting, setExiting] = useState(false);

  function handleStart() {
    if (animating || exiting) return;
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setExiting(true);
    }, 400);
    setTimeout(() => {
      router.push("/prepare");
    }, 700);
  }

  return (
    <div
      className={`min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 transition-opacity duration-300 ${
        exiting ? "animate-land-exit" : ""
      }`}
    >
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight font-brand">
          NextRound
        </h1>
        <button
          type="button"
          onClick={handleStart}
          disabled={animating || exiting}
          className={`mt-12 rounded-3xl bg-emerald-500 px-16 py-5 text-2xl font-bold text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 hover:shadow-emerald-500/40 focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-80 transition-all ${
            animating ? "animate-start-press" : ""
          }`}
        >
          {exiting ? "Starting…" : "START"}
        </button>
      </div>
    </div>
  );
}
