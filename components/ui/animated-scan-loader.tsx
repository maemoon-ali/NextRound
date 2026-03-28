"use client";

// ── Animated scan loader ───────────────────────────────────────────────────
// A violet laser sweeps over the word "Timeline" while career data loads.
// Uses tl-scan / tl-cut keyframes defined in globals.css.

export function ScanLoader() {
  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {/* Word with laser sweep */}
      <div
        style={{
          position: "relative",
          fontSize: 52,
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: "rgba(255,255,255,0.82)",
          display: "inline-block",
        }}
      >
        {/* Clipped text — cut by the laser */}
        <span className="animate-tl-cut" style={{ display: "block" }}>
          Timeline
        </span>

        {/* Glow halo behind the laser */}
        <div
          className="animate-tl-scan"
          style={{
            position: "absolute",
            width: "100%",
            height: 8,
            borderRadius: 4,
            background: "rgba(167,139,250,0.55)",
            left: 0,
            zIndex: 0,
            filter: "blur(10px)",
          }}
        />

        {/* Sharp laser line */}
        <div
          className="animate-tl-scan"
          style={{
            position: "absolute",
            width: "100%",
            height: 4,
            borderRadius: 2,
            background: "#a78bfa",
            left: 0,
            zIndex: 1,
            opacity: 0.95,
          }}
        />
      </div>

      {/* Status text */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}
      >
        Scanning LinkedIn profile…
      </p>
    </div>
  );
}

export default ScanLoader;
