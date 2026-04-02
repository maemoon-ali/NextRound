"use client";

import { useState, useRef, useEffect } from "react";
import { UNIVERSITY_NAMES, getSchoolDomain } from "@/lib/us-universities";

function SchoolLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? "U";

  const box: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 5, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
  };

  if (failed || !domain) {
    return (
      <div style={{ ...box, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.25)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(96,165,250,0.8)" }}>{initial}</span>
      </div>
    );
  }

  // Use Google's favicon service keyed on the university's real domain —
  // every .edu has its own unique favicon, unlike generic logo APIs.
  return (
    <div style={{ ...box, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.15)" }}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        style={{ width: 16, height: 16, objectFit: "contain" }}
      />
    </div>
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
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);

  function handleChange(text: string) {
    onChange(text);
    setActiveIdx(-1);
    if (text.trim().length >= 1) {
      const q = text.toLowerCase();
      // Prioritize starts-with matches, then contains
      const startsWith = UNIVERSITY_NAMES.filter(u => u.toLowerCase().startsWith(q));
      const contains   = UNIVERSITY_NAMES.filter(u => !u.toLowerCase().startsWith(q) && u.toLowerCase().includes(q));
      const filtered   = [...startsWith, ...contains].slice(0, 6);
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
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(15,15,20,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "8px 14px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
          }}>
            Schools
          </div>

          {suggestions.map((school, i) => {
            const q = value.toLowerCase();
            const low = school.toLowerCase();
            const idx = low.indexOf(q);
            const domain = getSchoolDomain(school);
            const isActive = i === activeIdx;

            return (
              <button
                key={school}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(school); }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: isActive ? "rgba(96,165,250,0.10)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                  borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <SchoolLogo domain={domain ?? ""} name={school} />

                <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.88)" }}>
                  {idx >= 0 ? (
                    <>
                      {school.slice(0, idx)}
                      <span style={{ color: "#60a5fa", fontWeight: 700 }}>
                        {school.slice(idx, idx + q.length)}
                      </span>
                      {school.slice(idx + q.length)}
                    </>
                  ) : school}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
