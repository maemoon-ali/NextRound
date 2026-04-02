"use client";

import { useState, useRef, useEffect } from "react";
import { UNIVERSITY_NAMES, getSchoolDomain } from "@/lib/us-universities";

function DropdownSchoolIcon({ domain }: { domain: string }) {
  const [src, setSrc] = useState<"clearbit" | "favicon" | "none">("clearbit");
  if (src === "none") return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ color: "var(--pg-text-muted)", flexShrink: 0 }}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  );
  const imgSrc = src === "clearbit"
    ? `https://logo.clearbit.com/${domain}`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  return (
    <img
      src={imgSrc}
      alt=""
      aria-hidden
      onError={() => setSrc(src === "clearbit" ? "favicon" : "none")}
      style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0, borderRadius: 3 }}
    />
  );
}

export function SchoolInput({
  value,
  onChange,
  placeholder = "e.g. Stanford University",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);

  function handleChange(text: string) {
    onChange(text);
    if (text.trim().length >= 1) {
      const q = text.toLowerCase();
      const filtered = UNIVERSITY_NAMES.filter(
        (u) => u.toLowerCase().startsWith(q) || u.toLowerCase().includes(q)
      ).slice(0, 5);
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function select(school: string) {
    onChange(school);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--pg-glass)",
            border: "1px solid var(--pg-glass-border)",
            backdropFilter: "blur(16px)",
          }}
        >
          {suggestions.map((school) => {
            const q = value.toLowerCase();
            const low = school.toLowerCase();
            const idx = low.indexOf(q);
            const domain = getSchoolDomain(school);
            return (
              <button
                key={school}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(school); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-500/15 transition-colors duration-100 flex items-center gap-2.5"
                style={{ color: "var(--pg-text)" }}
              >
                {domain ? (
                  <DropdownSchoolIcon domain={domain} />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: "var(--pg-text-muted)", flexShrink: 0 }}>
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                )}
                <span>
                  {idx >= 0
                    ? (<>{school.slice(0, idx)}<span className="text-blue-400 font-medium">{school.slice(idx, idx + q.length)}</span>{school.slice(idx + q.length)}</>)
                    : school}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
