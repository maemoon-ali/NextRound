"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartButton() {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);
  const [exiting, setExiting] = useState(false);

  function handleStart() {
    if (animating || exiting) return;
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setExiting(true);
    }, 300);
    setTimeout(() => {
      router.push("/prepare");
    }, 600);
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={animating || exiting}
      className={`mt-12 rounded-3xl bg-emerald-500 px-16 py-5 text-2xl font-bold text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-80 transition-all duration-200 ${
        animating ? "scale-95" : ""
      }`}
    >
      {exiting ? "Starting…" : "START"}
    </button>
  );
}
