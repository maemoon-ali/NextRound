"use client";

interface AnimatedWaveformProps {
  className?: string;
}

/**
 * Scrolls WAVE.png horizontally like a paint roller using CSS background-image.
 * The wave tiles seamlessly at its natural width and scrolls infinitely left.
 */
export function AnimatedWaveform({ className }: AnimatedWaveformProps) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: "url('/wave.png')",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: "0 center",
        animation: "wave-roll 10s linear infinite",
        maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
    />
  );
}
