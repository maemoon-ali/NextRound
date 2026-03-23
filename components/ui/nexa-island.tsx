"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = "loading" | "loaded" | "open" | "closing";

interface Message {
  role: "user" | "assistant";
  text: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CIRCLE_SIZE = 140;
const PILL_W      = 900;
const PILL_H      = 230;
const AVATAR_SIZE = 126;
const LOAD_MS     = 900;
const RING_R      = 62;
const RING_CIRC   = 2 * Math.PI * RING_R;
const TOP_OFFSET  = 20;
const PEEK_H      = 44;

// Smooth deceleration — no overshoot, no bounce
const SMOOTH   = "cubic-bezier(0.22, 1, 0.36, 1)";
// Pure ease-out for collapse — reaches target cleanly with no spring
const EASE_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";

declare global { interface Window { __nexaOverPill?: boolean } }

// ── Keyframes ────────────────────────────────────────────────────────────────
const STYLE_ID = "nexa-island-styles";
function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes ni-dot-pulse {
      0%, 100% { opacity: 0.35; transform: scale(0.72); }
      50%       { opacity: 1;   transform: scale(1.12); }
    }
    @keyframes ni-msg-in {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes ni-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes ni-check-pop {
      0%   { opacity: 0; transform: scale(0.5); }
      60%  { opacity: 1; transform: scale(1.15); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes ni-ring-fill {
      from { stroke-dashoffset: var(--circ); }
      to   { stroke-dashoffset: 0; }
    }
    #nexa-island-root * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    #nexa-island-root input::placeholder {
      color: rgba(255,255,255,0.42);
      font-size: 14px;
    }
    #nexa-island-root ::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(s);
}

// ── SVG ring ─────────────────────────────────────────────────────────────────
function LoadingRing({ progress }: { progress: number }) {
  const dashoffset = RING_CIRC * (1 - progress);
  return (
    <svg
      width={CIRCLE_SIZE} height={CIRCLE_SIZE}
      viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Track */}
      <circle
        cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RING_R}
        fill="none" stroke="rgba(52,211,153,0.12)" strokeWidth={4}
      />
      {/* Glow ring */}
      <circle
        cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RING_R}
        fill="none" stroke="rgba(52,211,153,0.35)" strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={RING_CIRC} strokeDashoffset={dashoffset}
        style={{
          transformOrigin: "50% 50%", transform: "rotate(-90deg)",
          transition: "stroke-dashoffset 0.08s linear",
          filter: "blur(4px)",
        }}
      />
      {/* Sharp ring */}
      <circle
        cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RING_R}
        fill="none" stroke="#34d399" strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={RING_CIRC} strokeDashoffset={dashoffset}
        style={{
          transformOrigin: "50% 50%", transform: "rotate(-90deg)",
          transition: "stroke-dashoffset 0.08s linear",
        }}
      />
    </svg>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 14px" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#34d399",
          display: "inline-block",
          animation: `ni-dot-pulse 1.3s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Main Island ───────────────────────────────────────────────────────────────
export function NexaIsland({ onClose }: { onClose?: () => void }) {
  const [phase, setPhase]       = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [peeked, setPeeked]     = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Viewport
  const [vw, setVw] = useState(() => typeof window !== "undefined" ? window.innerWidth  : 1440);
  const [vh, setVh] = useState(() => typeof window !== "undefined" ? window.innerHeight : 900);

  // Drag / swipe
  const [pillHovered, setPillHovered]   = useState(false);
  const [swipeDY, setSwipeDY]           = useState(0);
  const [swipeExiting, setSwipeExiting] = useState(false);
  const dragStart  = useRef<number | null>(null);
  const dragging   = useRef(false);

  const lastClickTs = useRef(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef  = useRef(false);

  useEffect(() => { injectStyles(); }, []);

  // Viewport tracking
  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Loading → open
  useEffect(() => {
    if (phase !== "loading") return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min((Date.now() - start) / LOAD_MS, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(timerRef.current!);
        // Show checkmark briefly, then open
        setPhase("loaded");
        setTimeout(() => {
          setPhase("open");
          // Focus input after the expand animation settles
          setTimeout(() => inputRef.current?.focus(), 480);
        }, 520);
      }
    }, 16); // ~60fps ticks
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Close — never reset swipeExiting here so the pill stays off-screen
  // when dismissed by swipe (avoids snap-back before fade-out)
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("closing");
    setTimeout(() => { onClose?.(); }, 420);
  }, [onClose]);

  // Double-click → peek
  const handlePillClick = useCallback((e: React.MouseEvent) => {
    if (fullscreen) return;
    if (peeked) { setPeeked(false); return; }
    if ((e.target as HTMLElement).closest("input, button")) return;
    const now = Date.now();
    if (now - lastClickTs.current < 320) setPeeked(true);
    lastClickTs.current = now;
  }, [peeked, fullscreen]);

  const collapseFullscreen = useCallback(() => {
    setFullscreen(false);
    setTimeout(() => inputRef.current?.focus(), 420);
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    dragging.current  = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    if (Math.abs(dy) > 6) dragging.current = true;
    if (dragging.current) setSwipeDY(dy);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    dragging.current  = false;

    if (dy < -55 && !fullscreen) {
      setSwipeExiting(true);
      setSwipeDY(-280);
      setTimeout(() => close(), 300);
    } else if (dy > 80 && !fullscreen) {
      setSwipeDY(0);
      setFullscreen(true);
      setTimeout(() => inputRef.current?.focus(), 500);
    } else {
      setSwipeDY(0);
    }
  }, [close, fullscreen]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setTyping(true);

    try {
      const res = await fetch("/api/nexa-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, userMessage: text }),
      });

      if (!res.ok) throw new Error("bad response");

      const isStream = res.headers.get("content-type")?.includes("text/event-stream");

      if (isStream && res.body) {
        setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
        setTyping(false);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buf     = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") { reader.cancel(); break; }
            try {
              const token: string = JSON.parse(payload);
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  text: msgs[msgs.length - 1].text + token,
                };
                return msgs;
              });
            } catch { /* skip malformed */ }
          }
        }
      } else {
        const data = await res.json();
        const reply = typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "I'm having trouble connecting right now. Try again in a moment.";
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        setTyping(false);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: "I'm having trouble connecting right now. Try again in a moment.",
      }]);
      setTyping(false);
    }
  }, [input, messages]);

  // ── Geometry ──────────────────────────────────────────────────────────────
  const isOpen    = phase === "open";
  const isClosing = phase === "closing";
  // Content stays mounted during close so it fades out (not pops out)
  const showContent = isOpen || isClosing;

  const fullW = Math.round(Math.min(vw * 0.92, 1100));
  const fullH = Math.round(vh * 0.82);

  // During closing: target CIRCLE_SIZE so the shell animates back to a circle.
  // During swipe-exit the pill is already off-screen so the shrink is invisible.
  const pillWidth   = fullscreen ? fullW : (isOpen ? PILL_W : CIRCLE_SIZE);
  const shellHeight = fullscreen ? fullH : (isOpen ? PILL_H : CIRCLE_SIZE);

  // ── Vertical position ─────────────────────────────────────────────────────
  const peekDY  = peeked ? -(PILL_H + TOP_OFFSET - PEEK_H) : 0;
  const totalDY = isClosing
    ? (swipeExiting ? swipeDY : 0)   // swipe: stay off-screen; normal: collapse in place
    : peekDY + swipeDY;

  const fullY = Math.round((vh - fullH) / 2);

  // Root: full viewport width — shell centres itself via margin: auto.
  const rootStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    zIndex: 9999,
    pointerEvents: "none",
    willChange: "transform, opacity",
    transform: fullscreen
      ? `translateY(${fullY}px)`
      : `translateY(${TOP_OFFSET + totalDY}px)`,
    transition: dragging.current
      ? "none"
      : isClosing
        ? "opacity 0.30s ease"          // just fade — no transform fighting the collapse
        : fullscreen
          ? `transform 0.50s ${SMOOTH}`
          : `transform 0.42s ${SMOOTH}`,
    opacity: isClosing ? 0 : 1,
  };

  // Shell animates PILL_W×PILL_H → CIRCLE_SIZE×CIRCLE_SIZE on close.
  // All three properties use the SAME duration so width, height and
  // border-radius all reach their targets simultaneously — no in-between
  // rectangle that causes a visual bounce.
  const shellTransition = dragging.current
    ? "none"
    : isClosing
      ? `width 0.30s ${EASE_OUT}, height 0.30s ${EASE_OUT}, border-radius 0.30s ${EASE_OUT}`
      : fullscreen
        ? `width 0.50s ${SMOOTH}, height 0.50s ${SMOOTH}, border-radius 0.50s ${SMOOTH}, border-color 0.50s ease`
        : `width 0.50s ${SMOOTH}, height 0.40s ${SMOOTH}, border-radius 0.40s ${SMOOTH}`;

  // ── Render ────────────────────────────────────────────────────────────────
  const island = (
    <>
      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div
          onClick={collapseFullscreen}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.52)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9998,
            animation: "ni-fade-in 0.28s ease forwards",
          }}
        />
      )}

      <div id="nexa-island-root" style={rootStyle} onClick={(e) => e.stopPropagation()}>
        {/* ── Pill shell ── */}
        <div
          onClick={handlePillClick}
          onMouseEnter={() => { window.__nexaOverPill = true; setPillHovered(true); }}
          onMouseLeave={() => { window.__nexaOverPill = false; setPillHovered(false); }}
          style={{
            // Shell centers itself symmetrically as its width animates
            margin: "0 auto",
            position: "relative",
            width: pillWidth,
            height: shellHeight,
            borderRadius: fullscreen ? 28 : CIRCLE_SIZE / 2,
            background: "#000000",
            fontFamily: "var(--font-inter), 'Inter', sans-serif",
            // Crisp 1px border instead of blurry box-shadow ring
            border: isOpen || phase === "loading" || phase === "loaded"
              ? "1px solid rgba(255,255,255,0.18)"
              : "1px solid transparent",
            boxShadow: fullscreen
              ? "0 24px 60px rgba(0,0,0,0.85)"
              : isOpen
                ? "0 12px 40px rgba(0,0,0,0.75)"
                : "0 6px 24px rgba(0,0,0,0.65)",
            // Centre loading circle — absolute children (expanded content) are out of flow
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: shellTransition,
            overflow: "hidden",
            pointerEvents: "all",
            userSelect: "none",
            // GPU compositing — prevents blurry text during scale/resize
            willChange: "width, height",
            transform: "translateZ(0)",
          }}
        >
          {/* ── Loading / loaded phase ── */}
          {(phase === "loading" || phase === "loaded") && (
            <div style={{
              position: "relative",
              width: CIRCLE_SIZE, height: CIRCLE_SIZE,
              borderRadius: "50%",
              flexShrink: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nexa-loading.png" alt="Nexa" draggable="false"
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: CIRCLE_SIZE, height: CIRCLE_SIZE,
                  objectFit: "cover", borderRadius: "50%", display: "block",
                  opacity: phase === "loaded" ? 0 : 1,
                  transition: "opacity 0.28s ease",
                }}
              />
              <LoadingRing progress={phase === "loaded" ? 1 : progress} />
              {phase === "loaded" && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "ni-check-pop 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards",
                }}>
                  <svg
                    width="46" height="46" viewBox="0 0 24 24" fill="none"
                    stroke="#34d399" strokeWidth="2.5" strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 8px rgba(52,211,153,0.7))" }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ── Drag bar ── */}
          {showContent && !fullscreen && (
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                position: "absolute", bottom: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 120, height: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "grab", zIndex: 10,
              }}
            >
              <div style={{
                width: 34, height: 3.5, borderRadius: 2,
                background: "rgba(255,255,255,0.25)",
                opacity: peeked ? 0 : pillHovered ? 1 : 0,
                transition: "opacity 0.22s ease",
              }} />
            </div>
          )}

          {/* ── Peek label ── */}
          {showContent && !fullscreen && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: PEEK_H,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", zIndex: 9,
            }}>
              <span style={{
                fontFamily: "var(--font-sora), 'Sora', sans-serif",
                fontWeight: 300, fontSize: 18, letterSpacing: "0.1em",
                color: "#ffffff", lineHeight: 1,
                opacity: peeked ? 1 : 0,
                transform: peeked ? "translateY(0)" : "translateY(5px)",
                transition: "opacity 0.28s ease, transform 0.28s ease",
              }}>nexa</span>
            </div>
          )}

          {/* ── Fullscreen half-orb ── */}
          {showContent && fullscreen && (
            <div style={{
              position: "absolute", left: 0, top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 6, pointerEvents: "none",
              animation: "ni-fade-in 0.38s ease 0.12s both",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nexa-avatar.jpeg" alt="Nexa" draggable="false"
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: fullH, height: fullH,
                  borderRadius: "50%", objectFit: "cover", display: "block",
                }}
              />
            </div>
          )}

          {/* ── Expanded pill contents ── */}
          {showContent && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "stretch",
              // Closing: content fades instantly so the shrinking shell looks clean
              // Peeked:  content hides, shell stays visible
              // Open:    content fades in with a short delay so shape leads
              opacity: (peeked || isClosing) ? 0 : 1,
              animation: (!peeked && !isClosing) ? "ni-fade-in 0.26s ease 0.20s both" : "none",
              transition: isClosing ? "opacity 0.12s ease" : peeked ? "opacity 0.18s ease" : "none",
              pointerEvents: (peeked || isClosing) ? "none" : "auto",
            }}>
              {/* Avatar column (normal pill only) */}
              {!fullscreen && (
                <div style={{
                  width: CIRCLE_SIZE, flexShrink: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/nexa-avatar.jpeg" alt="Nexa" draggable="false"
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      width: AVATAR_SIZE, height: AVATAR_SIZE,
                      borderRadius: "50%", objectFit: "cover",
                      flexShrink: 0, display: "block",
                    }}
                  />
                  <span style={{
                    fontFamily: "var(--font-sora), 'Sora', sans-serif",
                    fontWeight: 300, fontSize: 15, letterSpacing: "0.08em",
                    color: "#ffffff", lineHeight: 1, pointerEvents: "none",
                    opacity: messages.length > 0 ? 1 : 0,
                    transform: messages.length > 0 ? "translateY(0)" : "translateY(4px)",
                    transition: "opacity 0.35s ease, transform 0.35s ease",
                  }}>nexa</span>
                </div>
              )}

              {/* Chat panel */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
                paddingLeft: fullscreen ? Math.round(fullH / 2) + 24 : 0,
              }}>
                {/* Messages */}
                <div ref={scrollRef} style={{
                  flex: 1, overflowY: "auto", minHeight: 0, scrollbarWidth: "none",
                  display: "flex", flexDirection: "column",
                  alignItems: fullscreen ? "center" : "stretch",
                  padding: fullscreen ? "32px 40px 12px 16px" : "12px 38px 6px 14px",
                  gap: 10,
                }}>
                  <div style={{
                    width: "100%",
                    maxWidth: fullscreen ? 680 : "100%",
                    display: "flex", flexDirection: "column", gap: 10,
                    flex: messages.length === 0 ? 1 : undefined,
                    justifyContent: messages.length === 0 ? "center" : undefined,
                  }}>
                    {messages.length === 0 && !typing && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontFamily: "var(--font-sora), 'Sora', sans-serif",
                          fontWeight: 300,
                          fontSize: fullscreen ? 32 : 20,
                          letterSpacing: "0.08em",
                          color: "#ffffff", lineHeight: 1.1,
                        }}>nexa</span>
                        <p style={{
                          color: "rgba(255,255,255,0.52)",
                          fontSize: fullscreen ? 16 : 13.5,
                          margin: 0, textAlign: "center",
                          fontFamily: "var(--font-inter), 'Inter', sans-serif",
                          letterSpacing: "-0.01em",
                        }}>Ask Nexa anything about your job search…</p>
                      </div>
                    )}

                    {messages.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "88%",
                        padding: fullscreen ? "10px 16px" : "7px 13px",
                        borderRadius: 18,
                        background: m.role === "user"
                          ? "linear-gradient(135deg, #00c99b 0%, #0ea5e9 100%)"
                          : "rgba(99,102,241,0.18)",
                        border: m.role === "user" ? "none" : "1px solid rgba(139,92,246,0.32)",
                        color: "#ffffff",
                        fontSize: fullscreen ? 15 : 14,
                        lineHeight: 1.6,
                        fontFamily: "var(--font-inter), 'Inter', sans-serif",
                        letterSpacing: "-0.01em",
                        animation: "ni-msg-in 0.22s ease forwards",
                        boxShadow: m.role === "user" ? "0 2px 12px rgba(0,201,155,0.28)" : "none",
                      }}>
                        {m.role === "user" ? m.text : (
                          <ReactMarkdown
                            components={{
                              p:      ({ children }) => <p style={{ margin: "0 0 6px 0" }}>{children}</p>,
                              ul:     ({ children }) => <ul style={{ margin: "4px 0 6px 0", paddingLeft: 18, listStyleType: "disc" }}>{children}</ul>,
                              ol:     ({ children }) => <ol style={{ margin: "4px 0 6px 0", paddingLeft: 18, listStyleType: "decimal" }}>{children}</ol>,
                              li:     ({ children }) => <li style={{ margin: "2px 0", lineHeight: 1.55 }}>{children}</li>,
                              strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#ffffff" }}>{children}</strong>,
                              em:     ({ children }) => <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.82)" }}>{children}</em>,
                              code:   ({ children }) => (
                                <code style={{
                                  background: "rgba(0,0,0,0.3)", borderRadius: 4,
                                  padding: "1px 5px", fontSize: "0.88em", fontFamily: "monospace",
                                }}>{children}</code>
                              ),
                            }}
                          >
                            {m.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    ))}

                    {typing && <div style={{ alignSelf: "flex-start" }}><TypingDots /></div>}
                  </div>
                </div>

                {/* Input row */}
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: fullscreen ? "center" : "stretch",
                  gap: 8,
                  padding: fullscreen ? "8px 40px 28px 16px" : "4px 38px 24px 14px",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: fullscreen ? "100%" : undefined,
                    maxWidth: fullscreen ? 680 : undefined,
                    flex: fullscreen ? undefined : 1,
                  }}>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                      }}
                      placeholder="Ask Nexa…"
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.09)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 24,
                        padding: fullscreen ? "12px 20px" : "8px 16px",
                        color: "#ffffff",
                        fontSize: fullscreen ? 15 : 14,
                        outline: "none",
                        fontFamily: "var(--font-inter), 'Inter', sans-serif",
                        letterSpacing: "-0.01em", lineHeight: 1.4,
                        transition: "border-color 0.18s ease",
                      }}
                    />
                    <button
                      onClick={send}
                      disabled={!input.trim() || typing}
                      style={{
                        width: fullscreen ? 44 : 36,
                        height: fullscreen ? 44 : 36,
                        borderRadius: "50%",
                        background: input.trim() && !typing
                          ? "linear-gradient(135deg, #34d399, #0ea5e9)"
                          : "rgba(255,255,255,0.1)",
                        border: "none",
                        cursor: input.trim() && !typing ? "pointer" : "default",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.2s ease, transform 0.15s ease",
                        transform: input.trim() && !typing ? "scale(1)" : "scale(0.95)",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24" fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ width: 16, height: 16, flexShrink: 0, display: "block",
                          transform: "translate(-1px, 1px)" }}
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(island, document.body)
    : null;
}

// ── Trigger wrapper ───────────────────────────────────────────────────────────
export function NexaTrigger({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        data-nexa-trigger="true"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer", display: "contents" }}
      >
        {children}
      </div>
      {open && <NexaIsland onClose={() => setOpen(false)} />}
    </>
  );
}
