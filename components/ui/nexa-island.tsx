"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = "idle" | "loading" | "loaded" | "expanding" | "open" | "closing";

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

declare global { interface Window { __nexaOverPill?: boolean } }

// ── Keyframes ────────────────────────────────────────────────────────────────
const STYLE_ID = "nexa-island-styles";
function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes ni-dot-pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.75); }
      50%       { opacity: 1;  transform: scale(1.15); }
    }
    @keyframes ni-msg-in {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ni-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    #nexa-island-root * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    #nexa-island-root input::placeholder {
      color: rgba(255,255,255,0.45);
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
    <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}
      viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <circle cx={CIRCLE_SIZE/2} cy={CIRCLE_SIZE/2} r={RING_R}
        fill="none" stroke="rgba(52,211,153,0.15)" strokeWidth={4} />
      <circle cx={CIRCLE_SIZE/2} cy={CIRCLE_SIZE/2} r={RING_R}
        fill="none" stroke="rgba(52,211,153,0.4)" strokeWidth={8}
        strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={dashoffset}
        style={{ transformOrigin:"50% 50%", transform:"rotate(-90deg)",
          transition:"stroke-dashoffset 0.1s linear", filter:"blur(4px)" }} />
      <circle cx={CIRCLE_SIZE/2} cy={CIRCLE_SIZE/2} r={RING_R}
        fill="none" stroke="#34d399" strokeWidth={4}
        strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={dashoffset}
        style={{ transformOrigin:"50% 50%", transform:"rotate(-90deg)",
          transition:"stroke-dashoffset 0.1s linear" }} />
    </svg>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display:"flex", gap:5, alignItems:"center", padding:"10px 14px" }}>
      {[0,1,2].map((i) => (
        <span key={i} style={{
          width:8, height:8, borderRadius:"50%", background:"#34d399",
          display:"inline-block",
          animation:`ni-dot-pulse 1.2s ease-in-out ${i*0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Main Island ───────────────────────────────────────────────────────────────
export function NexaIsland({ onClose }: { onClose?: () => void }) {
  const [phase, setPhase]             = useState<Phase>("loading");
  const [progress, setProgress]       = useState(0);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [typing, setTyping]           = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const [peeked, setPeeked]           = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);

  // Viewport size — initialise immediately so first paint is centred
  const [vw, setVw] = useState(() => typeof window !== "undefined" ? window.innerWidth  : 0);
  const [vh, setVh] = useState(() => typeof window !== "undefined" ? window.innerHeight : 0);

  // Swipe / drag
  const [pillHovered, setPillHovered]   = useState(false);
  const [swipeDY, setSwipeDY]           = useState(0);
  const [swipeExiting, setSwipeExiting] = useState(false);
  const dragStart   = useRef<number | null>(null);
  const dragging    = useRef(false);

  const lastClickTs = useRef(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef  = useRef(false);

  useEffect(() => { injectStyles(); }, []);

  // Track viewport size
  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Pill hover flag for sidebar guard
  // (set via onMouseEnter/Leave on the pill shell)

  // Loading progress
  useEffect(() => {
    if (phase !== "loading") return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min((Date.now() - start) / LOAD_MS, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(timerRef.current!);
        setPhase("loaded");
        setTimeout(() => {
          setPhase("expanding");
          setTimeout(() => {
            setPhase("open");
            setPillVisible(true);
            setTimeout(() => inputRef.current?.focus(), 350);
          }, 50);
        }, 400);
      }
    }, 30);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Close
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("closing");
    setTimeout(() => { onClose?.(); }, 380);
  }, [onClose]);

  // Double-click → toggle peek
  const handlePillClick = useCallback((e: React.MouseEvent) => {
    if (fullscreen) return; // no double-click in fullscreen
    if (peeked) { setPeeked(false); return; }
    if ((e.target as HTMLElement).closest("input, button")) return;
    const now = Date.now();
    if (now - lastClickTs.current < 300) setPeeked(true);
    lastClickTs.current = now;
  }, [peeked, fullscreen]);

  // Collapse fullscreen back to pill
  const collapseFullscreen = useCallback(() => {
    setFullscreen(false);
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  // ── Drag bar handlers ─────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    dragging.current  = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    if (Math.abs(dy) > 6) dragging.current = true;
    if (dragging.current) setSwipeDY(dy); // allow both up and down
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    dragging.current  = false;

    if (dy < -55 && !fullscreen) {
      // Swipe up → dismiss
      setSwipeExiting(true);
      setSwipeDY(-260);
      setTimeout(() => close(), 320);
    } else if (dy > 80 && !fullscreen) {
      // Drag down → fullscreen expansion
      setSwipeDY(0);
      setFullscreen(true);
      setTimeout(() => inputRef.current?.focus(), 500);
    } else {
      // Snap back
      setSwipeDY(0);
    }
  }, [close, fullscreen]);

  // Send message — streams tokens from Ollama in real time (ChatGPT-style)
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
        // Add an empty assistant message and stream tokens into it
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
            } catch { /* skip malformed token */ }
          }
        }
      } else {
        // Fallback: non-streaming JSON response
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
  const isExpanded  = phase === "open" || phase === "expanding";
  const isClosing   = phase === "closing";

  // Fullscreen dimensions
  const fullW = vw > 0 ? Math.round(Math.min(vw * 0.92, 1100)) : PILL_W;
  const fullH = vh > 0 ? Math.round(vh * 0.82) : 700;

  const pillWidth   = fullscreen ? fullW : (isExpanded ? PILL_W : CIRCLE_SIZE);
  const shellHeight = fullscreen ? fullH : (isExpanded ? PILL_H : CIRCLE_SIZE);

  // Centre using the *active* width so the loading circle is also centred
  const normalX = vw > 0 ? Math.round(vw / 2) - Math.round(pillWidth / 2) : 0;
  const peekDY  = peeked ? -(PILL_H + TOP_OFFSET - PEEK_H) : 0;
  const totalDY = peekDY + swipeDY;

  const normalTransform = `translateX(${normalX}px) translateY(${TOP_OFFSET + totalDY}px)`;

  const fullX = vw > 0 ? Math.round((vw - fullW) / 2) : 0;
  const fullY = vh > 0 ? Math.round((vh - fullH) / 2) : 0;
  const fullTransform   = `translateX(${fullX}px) translateY(${fullY}px)`;

  const rootTransform = fullscreen ? fullTransform : normalTransform;
  const rootTransition = dragging.current
    ? "none"
    : fullscreen
      ? "transform 0.52s cubic-bezier(0.22,1,0.36,1)"
      : "transform 0.44s cubic-bezier(0.22,1,0.36,1)";

  // ── Render ────────────────────────────────────────────────────────────────
  const island = (
    <>
      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div
          onClick={collapseFullscreen}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            zIndex: 9998,
            animation: "ni-fade-in 0.3s ease forwards",
          }}
        />
      )}

      <div
        id="nexa-island-root"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          transform: rootTransform,
          width: pillWidth,
          zIndex: 9999,
          pointerEvents: "none",
          transition: rootTransition,
        }}
      >
        {/* ── Pill shell ── */}
        <div
          onClick={handlePillClick}
          onMouseEnter={() => { window.__nexaOverPill = true; setPillHovered(true); }}
          onMouseLeave={() => { window.__nexaOverPill = false; setPillHovered(false); }}
          style={{
            position: "relative",
            width: pillWidth,
            height: shellHeight,
            borderRadius: fullscreen ? 28 : CIRCLE_SIZE / 2,
            background: "#000000",
            fontFamily: "var(--font-inter), 'Inter', sans-serif",
            boxShadow: fullscreen
              ? "0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.1)"
              : isExpanded
                ? "0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.1)"
                : "0 6px 32px rgba(0,0,0,0.7)",
            transition: isClosing
              ? "width 0.30s ease, height 0.30s ease, border-radius 0.30s ease, opacity 0.28s ease"
              : "width 0.52s cubic-bezier(0.22,1,0.36,1), height 0.52s cubic-bezier(0.22,1,0.36,1), border-radius 0.52s cubic-bezier(0.22,1,0.36,1)",
            overflow: "hidden",
            opacity: isClosing ? 0 : 1,
            pointerEvents: "all",
            userSelect: "none",
          }}
        >
          {/* Loading phase */}
          {(phase === "loading" || phase === "loaded") && (
            <div style={{ position:"relative", width:CIRCLE_SIZE, height:CIRCLE_SIZE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nexa-loading.png" alt="Nexa" draggable="false" onDragStart={(e) => e.preventDefault()} style={{
                width:CIRCLE_SIZE, height:CIRCLE_SIZE,
                objectFit:"cover", borderRadius:"50%", display:"block",
                opacity: phase === "loaded" ? 0 : 1,
                transition: "opacity 0.3s ease",
              }} />
              {(phase === "loading" || phase === "loaded") && (
                <LoadingRing progress={phase === "loaded" ? 1 : progress} />
              )}
              {phase === "loaded" && (
                <div style={{ position:"absolute", inset:0, display:"flex",
                  alignItems:"center", justifyContent:"center",
                  animation:"ni-fade-in 0.2s ease forwards" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                    stroke="#34d399" strokeWidth="2.5" strokeLinecap="round"
                    style={{ filter:"drop-shadow(0 0 6px rgba(52,211,153,0.6))" }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Drag bar — hidden when peeked or fullscreen */}
          {isExpanded && !fullscreen && (
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                position:"absolute", bottom:0, left:"50%",
                transform:"translateX(-50%)",
                width:120, height:20,
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"grab", zIndex:10,
              }}
            >
              <div style={{
                width:36, height:4, borderRadius:2,
                background:"rgba(255,255,255,0.28)",
                opacity: peeked ? 0 : pillHovered ? 1 : 0,
                transition:"opacity 0.25s ease",
              }} />
            </div>
          )}

          {/* "nexa" peek label */}
          {isExpanded && !fullscreen && (
            <div style={{
              position:"absolute", bottom:0, left:0, right:0, height:PEEK_H,
              display:"flex", alignItems:"center", justifyContent:"center",
              pointerEvents:"none", zIndex:9,
            }}>
              <span style={{
                fontFamily:"var(--font-sora), 'Sora', sans-serif",
                fontWeight:300, fontSize:18, letterSpacing:"0.1em",
                color:"#ffffff", lineHeight:1,
                opacity: peeked ? 1 : 0,
                transform: peeked ? "translateY(0)" : "translateY(4px)",
                transition:"opacity 0.3s ease, transform 0.3s ease",
              }}>nexa</span>
            </div>
          )}


          {/* ── Fullscreen: half-cut orb at left edge — diameter = card height so it fills corner-to-corner ── */}
          {isExpanded && fullscreen && (
            <div style={{
              position: "absolute",
              left: 0,
              top: "50%",
              // Centre of orb on the card's left edge; overflow:hidden clips the left half
              transform: "translate(-50%, -50%)",
              zIndex: 6,
              pointerEvents: "none",
              animation: "ni-fade-in 0.35s ease 0.1s both",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nexa-avatar.jpeg" alt="Nexa" draggable="false" onDragStart={(e) => e.preventDefault()} style={{
                // Make the orb as tall as the card so it touches all four left corners
                width: fullH,
                height: fullH,
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }} />
            </div>
          )}

          {/* Expanded pill contents */}
          {isExpanded && (
            <div style={{
              position:"absolute", inset:0,
              display:"flex", alignItems:"stretch",
              opacity: pillVisible && !peeked ? 1 : 0,
              transition:"opacity 0.22s ease 0.08s",
              pointerEvents: peeked ? "none" : "auto",
            }}>
              {/* ── Normal pill: standard left avatar column ── */}
              {!fullscreen && (
                <div style={{
                  width: CIRCLE_SIZE, flexShrink:0,
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:6,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/nexa-avatar.jpeg" alt="Nexa" draggable="false" onDragStart={(e) => e.preventDefault()} style={{
                    width: AVATAR_SIZE, height: AVATAR_SIZE,
                    borderRadius:"50%", objectFit:"cover",
                    flexShrink:0, display:"block",
                  }} />
                  <span style={{
                    fontFamily:"var(--font-sora), 'Sora', sans-serif",
                    fontWeight:300, fontSize:15, letterSpacing:"0.08em",
                    color:"#ffffff", lineHeight:1,
                    opacity: messages.length > 0 ? 1 : 0,
                    transform: messages.length > 0 ? "translateY(0)" : "translateY(4px)",
                    transition:"opacity 0.4s ease, transform 0.4s ease",
                    pointerEvents:"none",
                  }}>nexa</span>
                </div>
              )}

              {/* Chat panel — full width in fullscreen, right column in pill */}
              <div style={{
                flex:1, display:"flex", flexDirection:"column", minWidth:0,
                // In fullscreen: clear the visible half-orb (fullH/2) plus a small gap
                paddingLeft: fullscreen ? Math.round(fullH / 2) + 24 : 0,
              }}>
                {/* Messages scroll */}
                <div ref={scrollRef} style={{
                  flex:1, overflowY:"auto", minHeight:0, scrollbarWidth:"none",
                  // In fullscreen: centered column with max-width
                  display:"flex", flexDirection:"column",
                  alignItems: fullscreen ? "center" : "stretch",
                  padding: fullscreen ? "32px 40px 12px 16px" : "12px 38px 6px 14px",
                  gap:10,
                }}>
                  {/* Content wrapper — centred in fullscreen */}
                  <div style={{
                    width: "100%",
                    maxWidth: fullscreen ? 680 : "100%",
                    display:"flex", flexDirection:"column", gap:10,
                    flex: messages.length === 0 ? 1 : undefined,
                    justifyContent: messages.length === 0 ? "center" : undefined,
                  }}>
                    {messages.length === 0 && !typing && (
                      <div style={{ display:"flex", flexDirection:"column",
                        alignItems:"center", gap:6 }}>
                        <span style={{
                          fontFamily:"var(--font-sora), 'Sora', sans-serif",
                          fontWeight:300,
                          fontSize: fullscreen ? 32 : 20,
                          letterSpacing:"0.08em",
                          color:"#ffffff", lineHeight:1.1,
                        }}>nexa</span>
                        <p style={{
                          color:"rgba(255,255,255,0.55)",
                          fontSize: fullscreen ? 16 : 13.5,
                          margin:0, textAlign:"center",
                          fontFamily:"var(--font-inter), 'Inter', sans-serif",
                          letterSpacing:"-0.01em",
                        }}>Ask Nexa anything about your job search…</p>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth:"88%",
                        padding: fullscreen ? "10px 16px" : "7px 13px",
                        borderRadius:18,
                        background: m.role === "user"
                          ? "linear-gradient(135deg, #00c99b 0%, #0ea5e9 100%)"
                          : "rgba(99,102,241,0.18)",
                        border: m.role === "user" ? "none" : "1px solid rgba(139,92,246,0.35)",
                        color:"#ffffff",
                        fontSize: fullscreen ? 15 : 14,
                        lineHeight:1.6,
                        fontFamily:"var(--font-inter), 'Inter', sans-serif",
                        letterSpacing:"-0.01em",
                        animation:"ni-msg-in 0.18s ease forwards",
                        boxShadow: m.role === "user" ? "0 2px 10px rgba(0,201,155,0.3)" : "none",
                      }}>
                        {m.role === "user" ? m.text : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p style={{ margin: "0 0 6px 0" }}>{children}</p>
                              ),
                              ul: ({ children }) => (
                                <ul style={{ margin: "4px 0 6px 0", paddingLeft: 18, listStyleType: "disc" }}>{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol style={{ margin: "4px 0 6px 0", paddingLeft: 18, listStyleType: "decimal" }}>{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li style={{ margin: "2px 0", lineHeight: 1.55 }}>{children}</li>
                              ),
                              strong: ({ children }) => (
                                <strong style={{ fontWeight: 700, color: "#ffffff" }}>{children}</strong>
                              ),
                              em: ({ children }) => (
                                <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.85)" }}>{children}</em>
                              ),
                              code: ({ children }) => (
                                <code style={{
                                  background: "rgba(0,0,0,0.3)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                  fontSize: "0.88em",
                                  fontFamily: "monospace",
                                }}>{children}</code>
                              ),
                            }}
                          >
                            {m.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    ))}
                    {typing && <div style={{ alignSelf:"flex-start" }}><TypingDots /></div>}
                  </div>
                </div>

                {/* Input row */}
                <div style={{
                  display:"flex", alignItems:"center",
                  justifyContent: fullscreen ? "center" : "stretch",
                  gap:8,
                  padding: fullscreen ? "8px 40px 28px 16px" : "4px 38px 24px 14px",
                }}>
                  {/* Centred wrapper in fullscreen */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:8,
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
                        flex:1,
                        background:"rgba(255,255,255,0.09)",
                        border:"1px solid rgba(255,255,255,0.16)",
                        borderRadius:24,
                        padding: fullscreen ? "12px 20px" : "8px 16px",
                        color:"#ffffff",
                        fontSize: fullscreen ? 15 : 14,
                        outline:"none",
                        fontFamily:"var(--font-inter), 'Inter', sans-serif",
                        letterSpacing:"-0.01em", lineHeight:1.4,
                      }}
                    />
                    <button
                      onClick={send}
                      disabled={!input.trim() || typing}
                      style={{
                        width: fullscreen ? 44 : 36,
                        height: fullscreen ? 44 : 36,
                        borderRadius:"50%",
                        background: input.trim() && !typing ? "#34d399" : "rgba(255,255,255,0.1)",
                        border:"none",
                        cursor: input.trim() && !typing ? "pointer" : "default",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        flexShrink:0, transition:"background 0.18s ease",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none"
                        stroke={input.trim() && !typing ? "#000000" : "#ffffff"}
                        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ width:17, height:17, flexShrink:0, display:"block",
                          transform:"translate(-1px, 1px)" }}>
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
        style={{ cursor:"pointer", display:"contents" }}
      >
        {children}
      </div>
      {open && <NexaIsland onClose={() => setOpen(false)} />}
    </>
  );
}
