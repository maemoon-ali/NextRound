"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WaveformLogo } from "@/components/WaveformLogo";

const ROTATING_PHRASES = [
  "Practice behavioral questions with confidence.",
  "Get AI-powered feedback on your responses.",
  "Land your dream role.",
  "Nail every interview.",
  "Real-time eye contact & tone analysis.",
  "Powered by LiveDataTechnologies workforce insights.",
  "Interview prep that actually works.",
];

/* Only people with a profile (avatarUrl). Company logos via Clearbit. Replace avatarUrl with real LinkedIn profile image URL when you have permission. */
const LINKEDIN_POSTS = [
  {
    name: "Sarah Chen",
    position: "Engineering Manager",
    company: "Stripe",
    domain: "stripe.com",
    logoFallback: "ST",
    quote: "The interview is your one shot to show how you think, not just what you know.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
  },
  {
    name: "Marcus Johnson",
    position: "Head of Talent",
    company: "Notion",
    domain: "notion.so",
    logoFallback: "NO",
    quote: "We don’t hire from resumes. We hire from conversations. Nail the conversation.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
  },
  {
    name: "Priya Patel",
    position: "VP of Product",
    company: "Figma",
    domain: "figma.com",
    logoFallback: "FI",
    quote: "Interviews are where strategy meets personality. Preparation is non-negotiable.",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
  },
  {
    name: "David Kim",
    position: "Recruiting Lead",
    company: "Linear",
    domain: "linear.app",
    logoFallback: "LN",
    quote: "The best candidates treat the interview like a two-way discovery, not an interrogation.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
  },
  {
    name: "Elena Rodriguez",
    position: "Director of People",
    company: "Vercel",
    domain: "vercel.com",
    logoFallback: "VE",
    quote: "First impressions in interviews set the tone for your entire tenure. Take them seriously.",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop",
  },
  {
    name: "James Wu",
    position: "Senior Technical Recruiter",
    company: "Meta",
    domain: "meta.com",
    logoFallback: "ME",
    quote: "Interviews are the gateway. Preparation and clarity there open every other door.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
  },
  {
    name: "Nina Okonkwo",
    position: "Chief People Officer",
    company: "Dropbox",
    domain: "dropbox.com",
    logoFallback: "DB",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
    quote: "You can have the best skills in the world; if you can’t articulate them in an interview, it doesn’t matter.",
  },
  {
    name: "Alex Rivera",
    position: "Hiring Manager",
    company: "Spotify",
    domain: "spotify.com",
    logoFallback: "SP",
    quote: "The interview is where your story meets our needs. Make your story clear and relevant.",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
  },
  {
    name: "Yuki Tanaka",
    position: "Talent Partner",
    company: "Airbnb",
    domain: "airbnb.com",
    logoFallback: "AB",
    quote: "We remember how you made us feel in the room. Preparation builds confidence; confidence builds connection.",
    avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150&h=150&fit=crop",
  },
  {
    name: "Rachel Foster",
    position: "Head of Recruiting",
    company: "Slack",
    domain: "slack.com",
    logoFallback: "SL",
    quote: "Interviews are a skill. The more you practice, the more you show up as the best version of yourself.",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop",
  },
  {
    name: "Omar Hassan",
    position: "Engineering Director",
    company: "Netflix",
    domain: "netflix.com",
    logoFallback: "NF",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop",
    quote: "The interview is the one moment you control. Don’t leave it to chance.",
  },
  {
    name: "Lisa Park",
    position: "VP of Talent",
    company: "Square",
    domain: "squareup.com",
    logoFallback: "SQ",
    quote: "Great interviews are a dialogue. Come prepared to listen as much as to share.",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop",
  },
  {
    name: "Chris Morgan",
    position: "Recruitment Director",
    company: "Salesforce",
    domain: "salesforce.com",
    logoFallback: "SF",
    quote: "Your interview performance often matters more than your pedigree. We hire for how you show up.",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0789e7d093?w=150&h=150&fit=crop",
  },
  {
    name: "Aisha Okeke",
    position: "People Operations Lead",
    company: "Asana",
    domain: "asana.com",
    logoFallback: "AS",
    quote: "Interviews are where potential becomes opportunity. One strong conversation can change your path.",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop",
  },
  {
    name: "Tom Bradley",
    position: "Talent Acquisition",
    company: "HubSpot",
    domain: "hubspot.com",
    logoFallback: "HS",
    quote: "The best hires are the ones who treat the interview as a partnership, not a test.",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop",
  },
];

const CARD_WIDTH = 460;
const GAP_PX = 5;
const CENTER_CARD_WIDTH = CARD_WIDTH;
const SIDE_CARD_WIDTH = CARD_WIDTH;
const CAROUSEL_SPACING = 200;
const SLIDE_DURATION_MS = 400;
const AUTO_SCROLL_MS = 4500;

/** Company logo via /api/logo. No background. */
function CompanyLogo({ name }: { name: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || "?").trim().slice(0, 2).toUpperCase() || "?";
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const logoSrc = name?.trim() ? `/api/logo?company=${encodeURIComponent(name.trim())}` : "";
  if (logoSrc && !imgFailed) {
    return (
      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-sm font-bold"
      style={{ color: `hsl(${hue}, 55%, 55%)` }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function QuoteCard({
  post,
  isCenter,
}: {
  post: (typeof LINKEDIN_POSTS)[0];
  isCenter: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border border-white/20 backdrop-blur-md flex flex-col gap-3 p-5 shadow-xl text-center ${isCenter ? "opacity-90 bg-white/20" : "bg-white/10"}`}
      style={{
        width: isCenter ? CENTER_CARD_WIDTH : SIDE_CARD_WIDTH,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className={`font-semibold text-white/95 truncate ${isCenter ? "text-lg" : "text-base"}`}>{post.name}</p>
          <p className={`text-white/60 truncate ${isCenter ? "text-base" : "text-sm"}`}>{post.position}</p>
        </div>
        <CompanyLogo name={post.company} />
      </div>
      <blockquote className={`text-white/80 leading-relaxed line-clamp-4 flex-1 text-center ${isCenter ? "text-base" : "text-sm"}`}>
        &ldquo;{post.quote}&rdquo;
      </blockquote>
    </article>
  );
}

const SLOT_WIDTH = CARD_WIDTH + GAP_PX;

function LinkedInGallery() {
  const L = LINKEDIN_POSTS.length;
  if (L === 0) return null;

  const displayList = [...LINKEDIN_POSTS, ...LINKEDIN_POSTS];
  const [centerIndex, setCenterIndex] = useState(0);
  const [noTransition, setNoTransition] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setCenterIndex((c) => {
        const next = c + 1;
        if (next >= L) {
          setNoTransition(true);
          return next;
        }
        return next;
      });
    }, AUTO_SCROLL_MS);
    return () => clearInterval(t);
  }, [L]);

  useEffect(() => {
    if (!noTransition || centerIndex < L) return;
    const id = requestAnimationFrame(() => {
      setCenterIndex(0);
      requestAnimationFrame(() => setNoTransition(false));
    });
    return () => cancelAnimationFrame(id);
  }, [noTransition, centerIndex, L]);

  const viewWidth = 2 * SLOT_WIDTH;
  const stripWidth = displayList.length * SLOT_WIDTH;
  const translateX = viewWidth / 2 - SLOT_WIDTH / 2 - centerIndex * SLOT_WIDTH;

  return (
    <section
      className="w-full flex-shrink-0 flex items-center justify-center overflow-hidden -mt-4"
      aria-label="What professionals say about interviews"
    >
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          perspective: "1200px",
          width: viewWidth,
          minHeight: 320,
        }}
      >
        <div
          className="flex flex-nowrap items-center"
          style={{
            width: stripWidth,
            transform: `translateX(${translateX}px)`,
            transition: noTransition ? "none" : `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            transformStyle: "preserve-3d",
          }}
        >
          {displayList.map((post, i) => {
            const d = i - centerIndex;
            const isCenter = d === 0;
            const scale = isCenter ? 1 : 0.88;
            const zIndex = isCenter ? 2 : 1;
            return (
              <div
                key={i}
                className="flex-shrink-0 flex justify-center items-center"
                style={{
                  width: SLOT_WIDTH,
                  transform: `translateZ(0) scale(${scale})`,
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                  zIndex,
                }}
              >
                <QuoteCard post={post} isCenter={isCenter} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TypewriterSubheading() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [pauseEnd, setPauseEnd] = useState(false);

  useEffect(() => {
    const phrase = ROTATING_PHRASES[phraseIndex];
    const typeSpeed = isDeleting ? 35 : 55;
    const pauseAtEnd = 2000;
    const pauseAtStart = 600;

    if (pauseEnd) {
      const delay = display.length === 0 ? pauseAtStart : pauseAtEnd;
      const t = setTimeout(() => {
        setPauseEnd(false);
        if (display.length === 0) setPhraseIndex((i) => (i + 1) % ROTATING_PHRASES.length);
      }, delay);
      return () => clearTimeout(t);
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (display.length < phrase.length) {
          setDisplay(phrase.slice(0, display.length + 1));
        } else {
          setPauseEnd(true);
          setIsDeleting(true);
        }
      } else {
        if (display.length > 0) {
          setDisplay(phrase.slice(0, display.length - 1));
        } else {
          setIsDeleting(false);
          setPauseEnd(true);
        }
      }
    }, display.length === phrase.length && !isDeleting ? pauseAtEnd : isDeleting && display.length === 0 ? pauseAtStart : typeSpeed);
    return () => clearTimeout(timeout);
  }, [phraseIndex, display, isDeleting, pauseEnd]);

  return (
    <p className="mt-0 min-h-[2rem] text-center text-sm sm:text-base text-emerald-100/75 font-light tracking-wide px-2">
      <span className="inline-block text-emerald-50/95">{display}</span>
      <span className="inline-block w-0.5 h-5 sm:h-6 ml-0.5 align-middle bg-cyan-400/90 animate-typewriter-cursor" aria-hidden />
    </p>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);
  const [exiting, setExiting] = useState(false);

  function handleStart() {
    if (animating || exiting) return;
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setExiting(true);
    }, 350);
    setTimeout(() => router.push("/prepare"), 700);
  }

  return (
    <div
      className={`relative h-screen flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        exiting ? "opacity-0" : ""
      }`}
    >
      {/* Green & blue moving background */}
      <div className="absolute inset-0 bg-[#0a0c0f]" />
      <div
        className="absolute inset-0 opacity-90 animate-gradient-drift"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 50% -10%, rgba(16, 185, 129, 0.22), transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 45%, rgba(6, 182, 212, 0.2), transparent 55%),
            radial-gradient(ellipse 60% 45% at 15% 85%, rgba(59, 130, 246, 0.18), transparent 55%)
          `,
          backgroundSize: "200% 200%, 200% 200%, 200% 200%",
          backgroundPosition: "0% 0%, 100% 50%, 0% 100%",
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `
            linear-gradient(180deg, transparent 0%, rgba(10, 12, 15, 0.25) 45%, rgba(10, 12, 15, 0.85) 100%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")
          `,
        }}
      />
      {/* Floating, pulsing orbs — emerald, cyan, blue */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] rounded-full bg-emerald-400/25 blur-[110px] animate-float-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-cyan-500/20 blur-[100px] animate-float-slower" />
        <div className="absolute top-1/2 right-1/3 w-72 h-72 rounded-full bg-blue-500/18 blur-[90px] animate-float-slow" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Subtle corner accent (logo-style mark) */}
      <div className="absolute bottom-8 right-8 w-3 h-3 rotate-45 border border-emerald-400/40 rounded-sm pointer-events-none z-10 animate-landing-fade-in" aria-hidden />

      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center flex-1 min-h-0 py-2 sm:py-4 w-full max-w-4xl mx-auto">
        <div className="mt-[35px]">
          <WaveformLogo variant="hero" />
        <h1 className="landing-title mt-5 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center animate-landing-title-in text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
          <span className="font-brand">NextRound</span>
        </h1>
        <p className="mt-5 text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-200/70 font-medium animate-landing-fade-in">
          Your interview practice coach
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={animating || exiting}
          className={`
            mt-5 rounded-2xl px-10 sm:px-14 py-3 sm:py-4 text-lg sm:text-xl font-semibold text-white
            bg-gradient-to-r from-emerald-500 to-blue-500
            shadow-[0_0_40px_rgba(16,185,129,0.3)]
            hover:shadow-[0_0_50px_rgba(16,185,129,0.4)]
            hover:from-emerald-400 hover:to-blue-400
            focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#0a0c0f]
            disabled:opacity-90
            transition-all duration-300 ease-out
            animate-landing-cta-in
            ${animating ? "scale-[0.97] shadow-[0_0_25px_rgba(16,185,129,0.35)]" : ""}
          `}
        >
          {exiting ? "Starting…" : "Get started"}
        </button>
        </div>

        <LinkedInGallery />

        <TypewriterSubheading />
      </div>
    </div>
  );
}
