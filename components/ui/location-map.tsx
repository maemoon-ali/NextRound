"use client";
import React, { useState, useEffect, useRef } from "react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function isRemote(location: string): boolean {
  const l = location.toLowerCase().trim();
  return (
    l.includes("remote") ||
    l === "worldwide" ||
    l === "anywhere" ||
    l === "global" ||
    l === ""
  );
}

// ─── 3-fold map SVG icon ──────────────────────────────────────────────────────

function FoldedMapIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

// ─── Full-screen map modal (centred) ─────────────────────────────────────────

interface MapModalProps {
  company: string;
  location: string;
  onClose: () => void;
}

function MapModal({ company, location, onClose }: MapModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company + " " + location)}`;
  const gmapsEmbed   = `https://maps.google.com/maps?q=${encodeURIComponent(company + " " + location)}&output=embed&hl=en&z=15`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 720, borderRadius: 18,
        background: "rgba(13,15,20,0.99)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.09)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgb(52,211,153)",
              letterSpacing: "0.08em", textTransform: "uppercase" }}>Office Location</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "#fff" }}>{company}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.40)" }}>{location}</p>
          </div>
          <button type="button" onClick={onClose} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)", cursor: "pointer", flexShrink: 0,
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div style={{ position: "relative", width: "100%", height: 420, background: "#0d0f14" }}>
          <iframe src={gmapsEmbed} title="Office location map" style={{
            width: "100%", height: "100%", border: "none", display: "block",
            filter: "invert(1) hue-rotate(180deg) brightness(0.82) saturate(1.15)",
          }} loading="lazy" />
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px 18px", display: "flex", alignItems: "center",
          justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,10,14,0.6)" }}>
          <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            textDecoration: "none",
            letterSpacing: "0.01em",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { const a = e.currentTarget as HTMLAnchorElement; a.style.background="rgba(255,255,255,0.14)"; a.style.borderColor="rgba(255,255,255,0.30)"; }}
          onMouseLeave={(e) => { const a = e.currentTarget as HTMLAnchorElement; a.style.background="rgba(255,255,255,0.08)"; a.style.borderColor="rgba(255,255,255,0.18)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in Google Maps
          </a>
        </div>
      </div>
      <style>{`@keyframes lm-modal-in { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  );
}

// ─── LocationMapCard ──────────────────────────────────────────────────────────

interface LocationMapCardProps {
  company: string;
  location: string;
}

// Collapsed size
const W_COLLAPSED = 176; // matches w-44 container
const H_COLLAPSED = 130;
// Expanded size — grows left and down
const W_EXPANDED  = 460;
const H_EXPANDED  = 380;

export function LocationMapCard({ company, location }: LocationMapCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState(0); // staggered reveal: 0→1→2→3
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Collapse when clicking outside the card
  useEffect(() => {
    if (!expanded) return;
    function handleOutsideClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    // Use mousedown so it fires before the click event
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [expanded]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (expanded) {
      timers.current.push(setTimeout(() => setPhase(1), 60));
      timers.current.push(setTimeout(() => setPhase(2), 260));
      timers.current.push(setTimeout(() => setPhase(3), 460));
    } else {
      setPhase(0);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [expanded]);

  if (!location || isRemote(location)) return null;

  const city = location.split(",")[0].trim();
  const rest = location.includes(",") ? location.split(",").slice(1).join(",").trim() : "";
  const displayLocation = rest ? `${city}, ${rest}` : city;
  const gmapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(company + " " + location)}&output=embed&hl=en&z=15`;

  return (
    <>
      <style>{`
        @keyframes lm-line-draw {
          from { stroke-dashoffset: 600; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes lm-bld-in {
          from { opacity: 0; transform: scale(0.75); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes lm-pin-drop {
          0%   { opacity: 0; transform: translate(-50%, -38px) scale(0.5); }
          65%  { opacity: 1; transform: translate(-50%, 5px)  scale(1.15); }
          82%  { transform: translate(-50%, -3px) scale(0.94); }
          100% { opacity: 1; transform: translate(-50%, 0)    scale(1); }
        }
        @keyframes lm-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lm-pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>

      {/* The card — position:absolute so it can overflow the w-44 container leftward */}
      <div
        ref={cardRef}
        onClick={() => setExpanded((e) => !e)}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: expanded ? W_EXPANDED : W_COLLAPSED,
          height: expanded ? H_EXPANDED : H_COLLAPSED,
          transition: "width 0.52s cubic-bezier(0.22,1,0.36,1), height 0.52s cubic-bezier(0.22,1,0.36,1)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "#0d0f14",
          overflow: "hidden",
          cursor: "pointer",
          userSelect: "none",
          zIndex: expanded ? 50 : 5,
          boxShadow: expanded ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(52,211,153,0.15)" : "0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {/* Subtle gradient sheen */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          background: "linear-gradient(135deg, rgba(52,211,153,0.04) 0%, transparent 55%, rgba(255,255,255,0.015) 100%)" }} />

        {/* ── MAP LAYER (expanded) ── */}
        {expanded && (
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            {/* Google Maps iframe */}
            <iframe src={gmapsEmbed} title="Office location"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                border: "none",
                filter: "invert(1) hue-rotate(180deg) brightness(0.78) saturate(1.2)",
                opacity: phase >= 1 ? 0.9 : 0,
                transition: "opacity 0.55s ease",
                pointerEvents: "none",
              }}
            />

            {/* No overlay — Google Maps iframe shows cleanly */}
          </div>
        )}


        {/* ── UI LAYER (always on top) ── */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "14px 14px 16px",
          pointerEvents: "none", // let clicks pass through to the card — buttons override this
        }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {/* Folded map icon — hidden when expanded (pin takes over) */}
            <div style={{ opacity: expanded ? 0 : 1, transition: "opacity 0.2s ease",
              filter: "drop-shadow(0 0 6px rgba(52,211,153,0.45))", pointerEvents: "none" }}>
              <FoldedMapIcon size={20} color="rgb(52,211,153)" />
            </div>

            {/* LIVE badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* LIVE badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 8px",
                borderRadius: 99,
                background: expanded ? "rgba(13,15,20,0.82)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgb(52,211,153)",
                  animation: "lm-pulse-dot 2.2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.10em" }}>
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row — pointerEvents:all so clicking here still collapses the card */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, pointerEvents: "all" }}>
            {/* City + expand button on same row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: expanded ? 17 : 13,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                  textShadow: expanded ? "0 1px 8px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.6)" : "none",
                  transition: "font-size 0.3s ease",
                }}>
                  {displayLocation}
                </p>

                {/* Company subtitle — only when expanded */}
                {expanded && phase >= 3 && (
                  <p style={{
                    margin: 0, fontSize: 12, color: "rgba(255,255,255,0.55)",
                    textShadow: "0 1px 6px rgba(0,0,0,0.9)",
                    animation: "lm-fade-up 0.35s ease both",
                  }}>
                    {company}
                  </p>
                )}

                {/* Animated green underline */}
                <div style={{
                  height: 1, width: "68%",
                  background: "linear-gradient(to right, rgb(52,211,153), rgba(52,211,153,0.15))",
                  transformOrigin: "left",
                  transform: expanded ? "scaleX(1)" : "scaleX(0.35)",
                  transition: "transform 0.48s cubic-bezier(0.22,1,0.36,1)",
                }} />
              </div>

              {/* Expand button — bottom-right, only when expanded */}
              {expanded && (
                <button
                  type="button"
                  title="Full screen map"
                  onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
                  style={{
                    pointerEvents: "all",
                    flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: 8,
                    background: "rgba(13,15,20,0.85)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.65)",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { const b = e.currentTarget; b.style.background="rgba(52,211,153,0.18)"; b.style.borderColor="rgba(52,211,153,0.4)"; b.style.color="rgb(52,211,153)"; }}
                  onMouseLeave={(e) => { const b = e.currentTarget; b.style.background="rgba(13,15,20,0.85)"; b.style.borderColor="rgba(255,255,255,0.14)"; b.style.color="rgba(255,255,255,0.65)"; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen modal */}
      {modalOpen && (
        <MapModal company={company} location={location} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ─── LocationMapButton (icon-only, kept for potential reuse) ──────────────────

export function LocationMapButton({ company, location }: { company: string; location: string }) {
  const [open, setOpen] = useState(false);
  if (!location || isRemote(location)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}
        title="View office on map" aria-label="View office on map"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(30,32,40,0.80)", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(160,160,180,0.85)", cursor: "pointer", flexShrink: 0,
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background="rgba(52,211,153,0.14)"; b.style.borderColor="rgba(52,211,153,0.40)"; b.style.color="rgb(52,211,153)"; }}
        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background="rgba(30,32,40,0.80)"; b.style.borderColor="rgba(255,255,255,0.12)"; b.style.color="rgba(160,160,180,0.85)"; }}
      >
        <FoldedMapIcon size={20} />
      </button>
      {open && <MapModal company={company} location={location} onClose={() => setOpen(false)} />}
    </>
  );
}
