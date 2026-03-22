"use client";

import { useState } from "react";

interface CompanyLogoProps {
  name: string;
  domain?: string;
  /** Tailwind size classes for the outer box, defaults to "h-12 w-12" */
  size?: string;
}

/**
 * Loads a company logo via the /api/logo proxy.
 * The proxy fetches from Logo.dev / UpLead / Google in parallel
 * and returns the first valid high-res image.
 * Falls back to coloured initials if the proxy returns 404.
 */
export function CompanyLogo({ name, domain, size = "h-12 w-12" }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);

  const initial = (name || "?").trim().slice(0, 2).toUpperCase() || "?";
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const boxClass = `flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-none text-sm font-bold`;

  const src = domain
    ? `/api/logo?domain=${encodeURIComponent(domain)}`
    : name?.trim()
      ? `/api/logo?company=${encodeURIComponent(name.trim())}`
      : "";

  if (src && !failed) {
    return (
      <div className={boxClass + " bg-white"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="h-full w-full object-contain p-1.5"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={boxClass + " bg-white"}
      style={{ color: `hsl(${hue}, 60%, 60%)` }}
    >
      {initial}
    </div>
  );
}
