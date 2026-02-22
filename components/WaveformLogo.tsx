"use client";

const WAVEFORM_PATHS = [
  "M 0 50 Q 62 28 125 50 T 250 50 T 375 50 T 500 50",
  "M 0 50 Q 62 72 125 50 T 250 50 T 375 50 T 500 50",
  "M 0 50 C 80 15 170 85 250 50 C 330 15 420 85 500 50",
  "M 0 50 C 70 85 180 18 250 50 C 320 82 430 15 500 50",
  "M 0 50 C 50 42 100 28 150 50 C 200 72 250 58 300 50 C 350 42 400 28 450 50 C 475 58 500 50 500 50",
  "M 0 50 C 100 20 150 75 250 50 C 350 25 400 80 500 50",
  "M 0 50 C 125 12 250 88 375 50 C 450 30 500 50 500 50",
];

const gradientId = "waveform-logo-gradient";
const filterId = "waveform-logo-glow";

/** Waveform logo (emerald → cyan → blue). Use variant "hero" for homepage, "compact" for headers. */
export function WaveformLogo({
  variant = "compact",
  className = "",
}: {
  variant?: "hero" | "compact";
  className?: string;
}) {
  const isHero = variant === "hero";
  return (
    <div
      className={isHero ? "w-full max-w-2xl mx-auto mb-1 sm:mb-2 animate-waveform-drift" : "flex justify-center"}
      aria-hidden
    >
      <svg
        viewBox="0 0 500 100"
        className={
          isHero
            ? `w-full h-14 sm:h-20 md:h-24 text-[#0a0c0f] ${className}`
            : `h-8 w-32 text-[#0a0c0f] ${className}`
        }
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.95" />
            <stop offset="50%" stopColor="rgb(6, 182, 212)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.95" />
          </linearGradient>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {WAVEFORM_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={i === 2 || i === 3 ? 2.2 : 1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75 + (i % 3) * 0.08}
            filter={`url(#${filterId})`}
          />
        ))}
        <circle cx="0" cy="50" r="3" fill={`url(#${gradientId})`} opacity="0.9" filter={`url(#${filterId})`} />
        <circle cx="500" cy="50" r="3" fill={`url(#${gradientId})`} opacity="0.9" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}
