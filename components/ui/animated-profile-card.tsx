"use client";

import { cn } from "@/lib/utils";
import React, { forwardRef, useRef, useCallback, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

// ── LinkedIn icon ─────────────────────────────────────────────────────────────
function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ── Card content (rendered in both base and overlay layers) ───────────────────
interface ProfileCardBodyProps {
  fullName: string;
  careerRoute: string;
  linkedInUrl: string;
  /** true = light text on the LinkedIn-blue overlay */
  onAccent?: boolean;
}

function ProfileCardBody({ fullName, careerRoute, linkedInUrl, onAccent = false }: ProfileCardBodyProps) {
  return (
    <div className={cn("flex flex-col gap-2.5 p-4", onAccent ? "text-white" : "text-white")}>
      {/* Name + LinkedIn icon row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-semibold text-sm leading-snug truncate", onAccent ? "text-white" : "text-white")}>
            {fullName}
          </p>
          <p className={cn("text-[11px] mt-0.5 font-medium tracking-wide", onAccent ? "text-white/70" : "text-zinc-500")}>
            Career Pathway
          </p>
        </div>
        {/* LinkedIn link — click still works through the GSAP overlay */}
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${fullName} on LinkedIn`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 transition-opacity hover:opacity-70",
            onAccent ? "text-white" : "text-[#0A66C2]"
          )}
        >
          <LinkedInIcon className="h-5 w-5" />
        </a>
      </div>

      {/* Career route */}
      <p className={cn(
        "text-xs leading-relaxed line-clamp-4",
        onAccent ? "text-white/85" : "text-zinc-400"
      )}>
        {careerRoute}
      </p>
    </div>
  );
}

// ── Animated reveal container ─────────────────────────────────────────────────
export interface ProfileRevealCardProps extends React.HTMLAttributes<HTMLDivElement> {
  fullName: string;
  careerRoute: string;
  linkedInUrl: string;
}

export const ProfileRevealCard = forwardRef<HTMLDivElement, ProfileRevealCardProps>(
  ({ fullName, careerRoute, linkedInUrl, className, ...rest }, ref) => {
    const holderRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Use the app's own class-based theme detection (no next-themes needed)
    const [isDark, setIsDark] = useState(true);
    useEffect(() => {
      const update = () => setIsDark(document.documentElement.classList.contains("dark"));
      update();
      const observer = new MutationObserver(update);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }, []);

    const assignRef = useCallback(
      (el: HTMLDivElement | null) => {
        (holderRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (typeof ref === "function") {
          ref(el);
        } else if (ref) {
          // RefObject has a read-only .current in older TS typings — cast to bypass
          (ref as { current: HTMLDivElement | null }).current = el;
        }
      },
      [ref]
    );

    // Circle originates from the center of the LinkedIn icon (top-right, inside p-4 padding)
    // Icon is h-5 w-5 (20px), center = (card_width - 16px padding - 10px half) = calc(100% - 26px), y = 26px
    // Radius 18px gives ~4px clearance around the icon's corners so the square never clips the circle edge
    const START = "circle(18px at calc(100% - 26px) 26px)";
    const END   = "circle(170% at calc(100% - 26px) 26px)";

    useGSAP(() => {
      gsap.set(overlayRef.current, { clipPath: START });
    }, { scope: holderRef });

    const reveal = () =>
      gsap.to(overlayRef.current, { clipPath: END, duration: 0.65, ease: "expo.inOut" });

    const conceal = () =>
      gsap.to(overlayRef.current, { clipPath: START, duration: 0.85, ease: "expo.out" });

    return (
      <div
        ref={assignRef}
        onMouseEnter={reveal}
        onMouseLeave={conceal}
        className={cn(
          "relative overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-800/50",
          className
        )}
        {...rest}
      >
        {/* Base layer — dark card */}
        <ProfileCardBody
          fullName={fullName}
          careerRoute={careerRoute}
          linkedInUrl={linkedInUrl}
          onAccent={false}
        />

        {/* Overlay layer — LinkedIn blue, reveals from the icon */}
        <div
          ref={overlayRef}
          className="absolute inset-0 h-full w-full"
          style={{ backgroundColor: "#0A66C2" }}
        >
          <ProfileCardBody
            fullName={fullName}
            careerRoute={careerRoute}
            linkedInUrl={linkedInUrl}
            onAccent={true}
          />
        </div>
      </div>
    );
  }
);

ProfileRevealCard.displayName = "ProfileRevealCard";
