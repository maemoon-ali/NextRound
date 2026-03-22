"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FrostedGlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: number; // tilt degrees, default 12
}

export function FrostedGlassCard({
  children,
  className,
  style,
  intensity = 2,
}: FrostedGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateY = ((x - centerX) / centerX) * intensity;
        const rotateX = ((y - centerY) / centerY) * -intensity;

        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
      });
    };

    const handleMouseLeave = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [intensity]);

  return (
    <div
      ref={cardRef}
      className={cn("frosted-glass-card", className)}
      style={{
        transition: "transform 0.15s cubic-bezier(0.25, 1.1, 0.4, 1)",
        transformStyle: "preserve-3d",
        willChange: "transform",
        ...style,
      }}
    >
      {/* Dynamic glare layer — follows mouse */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-10 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle 160px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.10) 0%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
