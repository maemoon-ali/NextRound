"use client";

import React, { useState, useEffect, useRef } from "react";

declare global { interface Window { __nexaOverPill?: boolean } }
import { NexaTrigger } from "@/components/ui/nexa-island";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search as SearchIcon,
  BookmarkFilled,
  Analytics,
  Settings as SettingsIcon,
  User as UserIcon,
  ChevronDown as ChevronDownIcon,
  AddLarge,
  Time,
  CheckmarkOutline,
  StarFilled,
  ChartBar,
  Task,
  Report,
  View,
  Microphone,
  Code,
  Archive,
  Flag,
  UserMultiple,
} from "@carbon/icons-react";

// ── Spring easing ───────────────────────────────────────────────────────────
const spring = "cubic-bezier(0.25, 1.1, 0.4, 1)";

// ── Self-contained theme toggle ──────────────────────────────────────────────
function useThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("nr-theme");
    const dark = saved ? saved === "dark" : document.documentElement.classList.contains("dark");
    setIsDark(dark);
  }, []);
  const toggle = () => {
    const root = document.documentElement;
    const nowDark = !isDark;
    root.classList.toggle("dark", nowDark);
    root.classList.toggle("light", !nowDark);
    localStorage.setItem("nr-theme", nowDark ? "dark" : "light");
    setIsDark(nowDark);
  };
  return { isDark, toggle };
}

// ── Types ───────────────────────────────────────────────────────────────────
export type SidebarSection = "matches" | "history" | "saved" | "behavioral" | "technical" | "progress" | "settings" | "timeline" | "alumni";

interface NavItem {
  id: SidebarSection | "home";
  icon: React.ReactNode;
  label: string;
  href?: string;
  accent?: "violet" | "blue" | string;
}

interface MenuItem {
  icon?: React.ReactNode;
  label: string;
  hasDropdown?: boolean;
  isActive?: boolean;
  children?: MenuItem[];
  onClick?: () => void;
  href?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface SidebarContent {
  title: string;
  sections: MenuSection[];
}

// ── Logo ────────────────────────────────────────────────────────────────────
function NRLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 36 : 40;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/png-logo.png"
      alt="NextRound"
      width={px}
      height={px}
      draggable="false"
      onDragStart={(e) => e.preventDefault()}
      className="shrink-0 object-contain"
      style={{
        filter: "drop-shadow(0 0 6px rgba(52,211,153,0.5))",
      }}
    />
  );
}

// ── Avatar ──────────────────────────────────────────────────────────────────
function AvatarCircle() {
  return (
    <div className="rounded-full shrink-0 size-9 flex items-center justify-center border border-white/20 text-xs font-semibold tracking-wide select-none"
      style={{ background: "linear-gradient(135deg, #059669 0%, #0284c7 100%)", color: "#fff" }}>
      MA
    </div>
  );
}

// ── Search box ──────────────────────────────────────────────────────────────
function SearchContainer({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div className={`relative shrink-0 ${isCollapsed ? "w-full flex justify-center" : "w-full"}`}>
      <div
        className={`bg-zinc-900 h-9 relative rounded-lg flex items-center border border-zinc-800 ${
          isCollapsed ? "w-9 min-w-9 justify-center" : "w-full"
        }`}
      >
        <div className={`flex items-center justify-center shrink-0 ${isCollapsed ? "p-1" : "px-2"}`}>
          <SearchIcon size={14} className="text-zinc-500" />
        </div>
        <div
          className="flex-1 relative overflow-hidden"
          style={{
            opacity: isCollapsed ? 0 : 1,
            width: isCollapsed ? 0 : undefined,
            transition: "opacity 0.2s ease",
          }}
        >
          <input
            type="text"
            placeholder="Search..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[13px] text-zinc-300 placeholder:text-zinc-600 leading-[20px] pr-2"
            tabIndex={isCollapsed ? -1 : 0}
          />
        </div>
      </div>
    </div>
  );
}

// ── Content map ─────────────────────────────────────────────────────────────
function getSidebarContent(
  section: SidebarSection,
  opts: {
    activeTab: "recommended" | "saved" | "attempted" | "timeline";
    onTabChange: (t: "recommended" | "saved" | "attempted" | "timeline") => void;
    onSectionChange?: (s: SidebarSection) => void;
    savedCount: number;
    attemptedCount: number;
  }
): SidebarContent {
  const { activeTab, onTabChange, onSectionChange, savedCount, attemptedCount } = opts;

  const contentMap: Record<SidebarSection, SidebarContent> = {
    matches: {
      title: "Job Matches",
      sections: [
        {
          title: "Results",
          items: [
            {
              icon: <StarFilled size={15} className="text-emerald-400" />,
              label: "Recommended",
              isActive: activeTab === "recommended",
              onClick: () => onTabChange("recommended"),
            },
            {
              icon: <BookmarkFilled size={15} className="text-zinc-400" />,
              label: `Saved Roles${savedCount > 0 ? ` (${savedCount})` : ""}`,
              isActive: activeTab === "saved",
              onClick: () => onTabChange("saved"),
            },
            {
              icon: <CheckmarkOutline size={15} className="text-zinc-400" />,
              label: `Completed${attemptedCount > 0 ? ` (${attemptedCount})` : ""}`,
              isActive: activeTab === "attempted",
              onClick: () => onTabChange("attempted"),
            },
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === "timeline" ? "text-violet-400" : "text-zinc-400"}>
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                  <line x1="12" y1="7" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="17"/>
                  <path d="M8 5h-2a2 2 0 0 0 0 4h2M16 5h2a2 2 0 0 1 0 4h-2M8 19h-2a2 2 0 0 1 0-4h2M16 19h2a2 2 0 0 0 0-4h-2"/>
                </svg>
              ),
              label: "Career Timeline",
              isActive: activeTab === "timeline",
              onClick: () => { onTabChange("timeline"); onSectionChange?.("matches"); },
            },
          ],
        },
        {
          title: "By Function",
          items: [
            { icon: <Code size={15} className="text-zinc-400" />, label: "Engineering" },
            { icon: <Analytics size={15} className="text-zinc-400" />, label: "Marketing" },
            { icon: <ChartBar size={15} className="text-zinc-400" />, label: "Finance" },
            { icon: <Task size={15} className="text-zinc-400" />, label: "Operations" },
            { icon: <UserMultiple size={15} className="text-zinc-400" />, label: "Sales" },
          ],
        },
        {
          title: "How It Works",
          items: [
            {
              icon: <Report size={15} className="text-zinc-400" />,
              label: "Match scoring",
              hasDropdown: true,
              children: [
                { label: "50% — Title similarity" },
                { label: "25% — Career path" },
                { label: "15% — Seniority level" },
                { label: "10% — Tenure & function" },
              ],
            },
          ],
        },
      ],
    },

    history: {
      title: "Career History",
      sections: [
        {
          title: "Actions",
          items: [
            {
              icon: <AddLarge size={15} className="text-emerald-400" />,
              label: "Add a role",
              onClick: () => onTabChange("recommended"),
            },
            {
              icon: <View size={15} className="text-zinc-400" />,
              label: "View matches",
              isActive: true,
              onClick: () => onTabChange("recommended"),
            },
          ],
        },
        {
          title: "Tips",
          items: [
            {
              icon: <Flag size={15} className="text-amber-400" />,
              label: "Add more roles for better matches",
            },
            {
              icon: <Time size={15} className="text-zinc-400" />,
              label: "Include years of experience",
            },
          ],
        },
      ],
    },

    saved: {
      title: "Saved Roles",
      sections: [
        {
          title: "Your Bookmarks",
          items: [
            {
              icon: <BookmarkFilled size={15} className="text-emerald-400" />,
              label: `All Saved${savedCount > 0 ? ` (${savedCount})` : ""}`,
              isActive: true,
              onClick: () => onTabChange("saved"),
            },
          ],
        },
        {
          title: "Sort By",
          items: [
            { icon: <ChartBar size={15} className="text-zinc-400" />, label: "Match % (high to low)" },
            { icon: <Time size={15} className="text-zinc-400" />, label: "Recently saved" },
          ],
        },
        {
          title: "Actions",
          items: [
            {
              icon: <Archive size={15} className="text-zinc-400" />,
              label: "Go to recommended",
              onClick: () => onTabChange("recommended"),
            },
          ],
        },
      ],
    },

    behavioral: {
      title: "Interview Practice",
      sections: [
        {
          title: "Session Types",
          items: [
            {
              icon: <Microphone size={15} className="text-emerald-400" />,
              label: "Behavioral Interview",
              isActive: true,
              href: "/interview",
            },
            {
              icon: <Code size={15} className="text-zinc-400" />,
              label: "Technical Interview",
              href: "/interview-technical",
            },
          ],
        },
        {
          title: "STAR Framework",
          items: [
            {
              icon: <Report size={15} className="text-zinc-400" />,
              label: "How to use STAR",
              hasDropdown: true,
              children: [
                { label: "S — Set the situation" },
                { label: "T — Describe your task" },
                { label: "A — Explain your actions" },
                { label: "R — Share the result" },
              ],
            },
            { icon: <Flag size={15} className="text-amber-400" />, label: "Give specific numbers" },
            { icon: <CheckmarkOutline size={15} className="text-zinc-400" />, label: "Practice out loud" },
          ],
        },
        {
          title: "After Practice",
          items: [
            {
              icon: <CheckmarkOutline size={15} className="text-zinc-400" />,
              label: "View my attempts",
              onClick: () => onTabChange("attempted"),
            },
          ],
        },
      ],
    },

    technical: {
      title: "Technical Interview",
      sections: [
        {
          title: "Session Types",
          items: [
            {
              icon: <Microphone size={15} className="text-zinc-400" />,
              label: "Behavioral Interview",
              href: "/interview",
            },
            {
              icon: <Code size={15} className="text-emerald-400" />,
              label: "Technical Interview",
              isActive: true,
              href: "/interview-technical",
            },
          ],
        },
        {
          title: "Key Areas",
          items: [
            {
              icon: <Report size={15} className="text-zinc-400" />,
              label: "What to cover",
              hasDropdown: true,
              children: [
                { label: "State your approach first" },
                { label: "Discuss time complexity" },
                { label: "Handle edge cases" },
                { label: "Explain tradeoffs" },
              ],
            },
          ],
        },
        {
          title: "After Practice",
          items: [
            {
              icon: <CheckmarkOutline size={15} className="text-zinc-400" />,
              label: "View my attempts",
              onClick: () => onTabChange("attempted"),
            },
          ],
        },
      ],
    },

    progress: {
      title: "My Progress",
      sections: [
        {
          title: "Sessions",
          items: [
            {
              icon: <CheckmarkOutline size={15} className="text-emerald-400" />,
              label: `All Attempts${attemptedCount > 0 ? ` (${attemptedCount})` : ""}`,
              isActive: true,
              onClick: () => onTabChange("attempted"),
            },
            {
              icon: <Microphone size={15} className="text-zinc-400" />,
              label: "Behavioral",
              onClick: () => onTabChange("attempted"),
            },
            {
              icon: <Code size={15} className="text-zinc-400" />,
              label: "Technical",
              onClick: () => onTabChange("attempted"),
            },
          ],
        },
        {
          title: "Improve",
          items: [
            { icon: <Flag size={15} className="text-amber-400" />, label: "Practice weak areas" },
            { icon: <AddLarge size={15} className="text-zinc-400" />, label: "Start new session" },
          ],
        },
      ],
    },

    settings: {
      title: "Settings",
      sections: [
        {
          title: "Preferences",
          items: [
            { icon: <UserIcon size={15} className="text-zinc-400" />, label: "Profile" },
            { icon: <Flag size={15} className="text-zinc-400" />, label: "Notifications" },
          ],
        },
        {
          title: "Account",
          items: [
            { icon: <Archive size={15} className="text-zinc-400" />, label: "Data & Privacy" },
          ],
        },
      ],
    },

    timeline: {
      title: "Timeline",
      sections: [
        {
          title: "Dream Job Planner",
          items: [
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                  <line x1="12" y1="7" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="17"/>
                </svg>
              ),
              label: "Career Timeline",
              isActive: activeTab === "timeline",
              onClick: () => { onTabChange("timeline"); onSectionChange?.("timeline"); },
            },
          ],
        },
        {
          title: "How It Works",
          items: [
            {
              icon: <Report size={15} className="text-zinc-400" />,
              label: "Powered by workforce data",
              hasDropdown: true,
              children: [
                { label: "Enter your dream role & company" },
                { label: "See real career paths taken" },
                { label: "Identify key stepping stones" },
                { label: "Explore alternative routes" },
              ],
            },
          ],
        },
      ],
    },

    alumni: {
      title: "College Network",
      sections: [
        {
          title: "Explore",
          items: [
            {
              icon: <UserMultiple size={15} className="text-blue-400" />,
              label: "Where alumni ended up",
              isActive: true,
            },
          ],
        },
        {
          title: "How It Works",
          items: [
            {
              icon: <Report size={15} className="text-zinc-400" />,
              label: "Powered by workforce data",
              hasDropdown: true,
              children: [
                { label: "Search any college or university" },
                { label: "See real alumni career paths" },
                { label: "Filter by company or role" },
                { label: "~100M verified profiles" },
              ],
            },
          ],
        },
      ],
    },
  };

  return contentMap[section];
}

// ── MenuItem ─────────────────────────────────────────────────────────────────
function SidebarMenuItem({
  item,
  isExpanded,
  onToggle,
  isCollapsed,
}: {
  item: MenuItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
}) {
  const handleClick = () => {
    if (item.hasDropdown && onToggle) {
      onToggle();
    } else {
      item.onClick?.();
    }
  };

  const inner = (
    <div
      className={`rounded-lg cursor-pointer transition-all duration-300 flex items-center relative group ${
        item.isActive
          ? "bg-emerald-500/15 border border-emerald-500/30"
          : "hover:bg-zinc-800/80 border border-transparent"
      } ${isCollapsed ? "w-9 h-9 justify-center" : "w-full h-9 px-3 py-1"}`}
      style={{ transitionTimingFunction: spring }}
      onClick={handleClick}
      title={isCollapsed ? item.label : undefined}
    >
      {item.icon && (
        <div className="flex items-center justify-center shrink-0">{item.icon}</div>
      )}
      <div
        className={`flex-1 relative overflow-hidden ${
          isCollapsed ? "opacity-0 w-0" : item.icon ? "opacity-100 ml-2.5" : "opacity-100"
        }`}
        style={{ transition: "opacity 0.2s ease" }}
      >
        <span
          className={`text-[13px] leading-[18px] truncate ${
            item.isActive ? "text-emerald-300 font-medium" : "text-zinc-300"
          }`}
        >
          {item.label}
        </span>
      </div>
      {item.hasDropdown && !isCollapsed && (
        <ChevronDownIcon
          size={13}
          className="text-zinc-500 ml-1 shrink-0 transition-transform duration-300"
          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      )}
    </div>
  );

  if (item.href && !item.hasDropdown) {
    return (
      <div className={`relative shrink-0 ${isCollapsed ? "flex justify-center" : "w-full"}`}>
        <Link href={item.href} className="block w-full">
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${isCollapsed ? "flex justify-center" : "w-full"}`}>
      {inner}
    </div>
  );
}

function SidebarSubMenuItem({ item }: { item: MenuItem }) {
  const inner = (
    <div className="h-8 w-full rounded-md cursor-pointer transition-colors hover:bg-zinc-800/60 flex items-center px-2.5">
      <span className="text-[12px] text-zinc-500 leading-[16px] truncate">{item.label}</span>
    </div>
  );
  if (item.href) return <Link href={item.href} className="block w-full pl-7 pr-1 py-[1px]">{inner}</Link>;
  return (
    <div className="w-full pl-7 pr-1 py-[1px]" onClick={item.onClick}>
      {inner}
    </div>
  );
}

function SidebarMenuSection({
  section,
  expandedItems,
  onToggleExpanded,
  isCollapsed,
}: {
  section: MenuSection;
  expandedItems: Set<string>;
  onToggleExpanded: (key: string) => void;
  isCollapsed?: boolean;
}) {
  return (
    <div className="flex flex-col w-full">
      {/* Section title */}
      <div
        className={`relative w-full overflow-hidden ${
          isCollapsed ? "h-0 opacity-0" : "h-8 opacity-100"
        }`}
      >
        <div className="flex items-center h-8 px-3">
          <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">{section.title}</span>
        </div>
      </div>

      {/* Items */}
      {section.items.map((item, idx) => {
        const key = `${section.title}-${idx}`;
        const isExpanded = expandedItems.has(key);
        return (
          <div key={key} className="w-full flex flex-col">
            <SidebarMenuItem
              item={item}
              isExpanded={isExpanded}
              onToggle={() => onToggleExpanded(key)}
              isCollapsed={isCollapsed}
            />
            {isExpanded && item.children && !isCollapsed && (
              <div className="flex flex-col gap-0.5 mb-1">
                {item.children.map((child, ci) => (
                  <SidebarSubMenuItem key={`${key}-${ci}`} item={child} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Detail sidebar (right panel) ─────────────────────────────────────────────
function DetailSidebar({
  section,
  activeTab,
  onTabChange,
  onSectionChange,
  savedCount,
  attemptedCount,
}: {
  section: SidebarSection;
  activeTab: "recommended" | "saved" | "attempted" | "timeline";
  onTabChange: (t: "recommended" | "saved" | "attempted" | "timeline") => void;
  onSectionChange?: (s: SidebarSection) => void;
  savedCount: number;
  attemptedCount: number;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const content = getSidebarContent(section, { activeTab, onTabChange, onSectionChange, savedCount, attemptedCount });

  const toggleExpanded = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <aside
      className={`border-r flex flex-col gap-3 items-start h-full ${
        isCollapsed ? "w-14 min-w-14 px-2 py-4 items-center" : "w-64 p-4"
      }`}
      style={{ background: "var(--pg-sidebar)", borderColor: "var(--pg-sidebar-border)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between w-full shrink-0">
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex items-center justify-center rounded-lg size-9 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Expand panel"
          >
            <span className="inline-block rotate-180">
              <ChevronDownIcon size={14} />
            </span>
          </button>
        ) : (
          <>
            <span className="text-[15px] font-semibold text-white truncate">{content.title}</span>
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="flex items-center justify-center rounded-lg size-8 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
              aria-label="Collapse panel"
            >
              <ChevronDownIcon size={14} className="-rotate-90" />
            </button>
          </>
        )}
      </div>

      {/* Search */}
      <SearchContainer isCollapsed={isCollapsed} />

      {/* Menu sections */}
      <div
        className={`flex flex-col w-full overflow-y-auto flex-1 transition-all duration-500 ${
          isCollapsed ? "gap-2 items-center" : "gap-3 items-start"
        }`}
        style={{ transitionTimingFunction: spring }}
      >
        {content.sections.map((sec, i) => (
          <SidebarMenuSection
            key={`${section}-${i}`}
            section={sec}
            expandedItems={expandedItems}
            onToggleExpanded={toggleExpanded}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>
    </aside>
  );
}

// ── Icon nav rail (left column) ───────────────────────────────────────────────
// Performance note:
//   The <aside> is FIXED at 56px in the flex layout — it never changes width,
//   so sibling elements never reflow. The inner 210px panel is absolutely
//   positioned and reveals itself via clip-path (a GPU compositor property).
//   Labels fade+slide with opacity+transform — both compositor-only.
//   Zero layout reflow during the entire animation.
const ICON_W = 56;
const PANEL_W = 210;
const CLIP_HIDE = PANEL_W - ICON_W; // 154px clipped from right when collapsed

function IconNavRail({
  activeSection,
  onSectionChange,
  pathname,
}: {
  activeSection: SidebarSection;
  onSectionChange: (s: SidebarSection) => void;
  pathname: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isDark, toggle } = useThemeToggle();

  const navItems: (NavItem & { accent?: "emerald" | "violet" })[] = [
    { id: "matches", icon: <SearchIcon size={20} />, label: "Find Roles", href: "/prepare" },
    { id: "saved", icon: <BookmarkFilled size={20} />, label: "Saved Roles", href: "/prepare" },
    { id: "behavioral", icon: <UserIcon size={20} />, label: "Behavioral Practice", href: "/interview" },
    { id: "technical", icon: <Code size={20} />, label: "Technical Practice", href: "/interview-technical" },
    { id: "progress", icon: <ChartBar size={20} />, label: "My Progress", href: "/prepare" },
    { id: "alumni", icon: <UserMultiple size={20} />, label: "College Network", href: "/prepare", accent: "blue" },
    {
      id: "timeline",
      accent: "violet",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2.2"/>
          <circle cx="12" cy="12" r="2.2"/>
          <circle cx="12" cy="19" r="2.2"/>
          <line x1="12" y1="7.2" x2="12" y2="9.8"/>
          <line x1="12" y1="14.2" x2="12" y2="16.8"/>
        </svg>
      ),
      label: "Timeline",
      href: "/prepare",
    },
  ];

  // GPU-only label animation — opacity + translateX, no maxWidth/width
  const labelStyle: React.CSSProperties = {
    opacity: hovered ? 1 : 0,
    transform: hovered ? "translateX(0px)" : "translateX(-8px)",
    transition: "opacity 0.22s ease, transform 0.28s cubic-bezier(0.25, 1.1, 0.4, 1)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    flexShrink: 0,
    pointerEvents: hovered ? "auto" : "none",
    willChange: "opacity, transform",
  };

  // Every row uses px-2 (8px) padding and a fixed 40px icon slot — icons always at x = 8..48
  const ROW = "flex items-center gap-3 h-10 rounded-lg";
  const ICON_SLOT = "shrink-0 w-10 h-10 flex items-center justify-center";

  return (
    // Outer aside: FIXED 56px — never changes, zero layout reflow
    <aside
      className="relative flex-shrink-0 h-full z-[30]"
      style={{ width: `${ICON_W}px` }}
      onMouseEnter={() => {
        if (window.__nexaOverPill) return;
        // Debounce: only expand after 160 ms of intentional hover
        hoverTimer.current = setTimeout(() => {
          if (!window.__nexaOverPill) setHovered(true);
        }, 160);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
        setHovered(false);
      }}
    >
      {/* Inner panel: absolutely positioned 210px wide, GPU clip-path reveal */}
      <div
        data-nav-rail
        className="absolute left-0 top-0 bottom-0 flex flex-col"
        style={{
          width: `${PANEL_W}px`,
          paddingTop: "12px",
          paddingBottom: "12px",
          paddingLeft: "8px",
          paddingRight: "8px",
          background: "var(--pg-sidebar)",
          borderRight: "1px solid var(--pg-sidebar-border)",
          clipPath: hovered
            ? "inset(0 0px 0 0)"
            : `inset(0 ${CLIP_HIDE}px 0 0)`,
          transition: `clip-path 0.3s cubic-bezier(0.25, 1.1, 0.4, 1), background-color 0.4s ease, border-color 0.4s ease`,
          willChange: "clip-path",
        }}
      >
        {/* ── Nav rows ── */}
        <div className="flex flex-col gap-0.5 w-full flex-1 mt-1">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            const isViolet = item.accent === "violet";
            const isBlue   = item.accent === "blue";
            const activeTextClass = isActive ? (isViolet ? "text-violet-400" : isBlue ? "text-blue-400" : "text-emerald-400") : "hover:bg-white/10 text-white/80 hover:text-white";
            const activeBgClass = isActive ? (isViolet ? "bg-violet-500/20" : isBlue ? "bg-blue-500/20" : "bg-emerald-500/20") : "";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id as SidebarSection)}
                className={`${ROW} w-full transition-colors duration-300 ${activeTextClass}`}
              >
                <span className={`${ICON_SLOT}${isActive ? " nav-icon-active" : ""}`}>
                  <span className={`nav-icon-shell flex items-center justify-center w-9 h-9 rounded-full transition-[background-color] duration-300 ${activeBgClass}`}>
                    {item.icon}
                  </span>
                </span>
                <span className="text-[13px] font-bold" style={labelStyle}>{item.label}</span>
              </button>
            );
          })}

          {/* ── Ask Nexa row — Dynamic Island trigger ── */}
          <NexaTrigger>
            <div className={`${ROW} w-full mt-1 hover:bg-white/10 rounded-lg transition-colors duration-300`} style={{ cursor: "pointer" }}>
              <div className={ICON_SLOT}>
                <NRLogo size="sm" />
              </div>
              <span style={{ ...labelStyle, fontSize: "13px", fontWeight: 700, color: "var(--pg-text)", whiteSpace: "nowrap" }}>
                Ask{" "}
                <span style={{ fontFamily: "var(--font-sora), sans-serif", fontWeight: 300, letterSpacing: "0.04em", color: "var(--pg-text)" }}>
                  nexa
                </span>
                {" "}
                <span style={{ fontSize: "11px", opacity: 0.55 }}>(Beta)</span>
              </span>
            </div>
          </NexaTrigger>
        </div>

        {/* ── Bottom rows ── */}
        <div className="flex flex-col gap-0.5 w-full mt-2">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`${ROW} w-full hover:bg-white/10 text-white/80 hover:text-white transition-colors duration-300 outline-none focus:outline-none focus-visible:outline-none`}
          >
            <span className={ICON_SLOT}>
              <span className="nav-icon-shell flex items-center justify-center w-9 h-9 rounded-full transition-[background-color] duration-300">
                {isDark ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4"/>
                    <line x1="12" y1="2" x2="12" y2="5"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                    <line x1="2" y1="12" x2="5" y2="12"/>
                    <line x1="19" y1="12" x2="22" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
                    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </span>
            </span>
            <span className="text-[13px] font-bold" style={{ ...labelStyle, color: "var(--pg-text-muted)" }}>
              {isDark ? "Light mode" : "Dark mode"}
            </span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => onSectionChange("settings")}
            className={`${ROW} w-full hover:bg-white/10 text-white/80 hover:text-white transition-colors duration-300`}
          >
            <span className={ICON_SLOT}>
              <span className="nav-icon-shell flex items-center justify-center w-9 h-9 rounded-full transition-[background-color] duration-300">
                <SettingsIcon size={20} />
              </span>
            </span>
            <span className="text-[13px] font-bold" style={{ ...labelStyle, color: "var(--pg-text-muted)" }}>Settings</span>
          </button>

          {/* Profile */}
          <div className={`${ROW} w-full`}>
            <span className={ICON_SLOT}><AvatarCircle /></span>
            <span className="text-[13px] font-bold" style={{ ...labelStyle, color: "var(--pg-text-muted)" }}>Maemoon Ali</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export interface NextRoundSidebarProps {
  activeTab: "recommended" | "saved" | "attempted" | "timeline";
  onTabChange: (t: "recommended" | "saved" | "attempted" | "timeline") => void;
  savedCount?: number;
  attemptedCount?: number;
  className?: string;
  onActiveSectionChange?: (section: SidebarSection) => void;
}

export function NextRoundSidebar({
  activeTab,
  onTabChange,
  savedCount = 0,
  attemptedCount = 0,
  className = "",
  onActiveSectionChange,
}: NextRoundSidebarProps) {
  const pathname = usePathname();

  // Map tab → default sidebar section
  const defaultSectionForTab = (t: "recommended" | "saved" | "attempted" | "timeline"): SidebarSection => {
    if (t === "saved") return "saved";
    if (t === "attempted") return "progress";
    if (t === "timeline") return "timeline";
    return "matches";
  };

  const [activeSection, setActiveSection] = useState<SidebarSection>(defaultSectionForTab(activeTab));

  const handleSectionChange = (section: SidebarSection) => {
    setActiveSection(section);
    onActiveSectionChange?.(section);
    // Sync tab when switching sections
    if (section === "saved") onTabChange("saved");
    else if (section === "progress") onTabChange("attempted");
    else if (section === "timeline") onTabChange("timeline");
    else if (section === "matches" || section === "history") onTabChange("recommended");
  };

  return (
    <div className={`flex h-full ${className}`}>
      <IconNavRail
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        pathname={pathname}
      />
    </div>
  );
}

export default NextRoundSidebar;
