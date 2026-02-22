/**
 * Bookmarked roles stored in localStorage. Separate "Saved" tab reads from here.
 */

export interface BookmarkedRole {
  company: string;
  role: string;
  location: string;
  function: string;
  level: string;
  reasons: string[];
}

const STORAGE_KEY = "mock-interview-bookmarks";

function getStored(): BookmarkedRole[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValidBookmark) : [];
  } catch {
    return [];
  }
}

function isValidBookmark(x: unknown): x is BookmarkedRole {
  return (
    typeof x === "object" &&
    x !== null &&
    "company" in x &&
    "role" in x &&
    typeof (x as BookmarkedRole).company === "string" &&
    typeof (x as BookmarkedRole).role === "string"
  );
}

export function getBookmarks(): BookmarkedRole[] {
  return getStored();
}

export function saveBookmark(entry: BookmarkedRole): void {
  const list = getStored();
  if (list.some((b) => b.company === entry.company && b.role === entry.role)) return;
  list.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    //
  }
}

export function removeBookmark(company: string, role: string): void {
  const list = getStored().filter((b) => !(b.company === company && b.role === role));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    //
  }
}

export function isBookmarked(company: string, role: string): boolean {
  return getStored().some((b) => b.company === company && b.role === role);
}

/** Build query string for /role from a bookmarked role. */
export function roleQueryString(b: BookmarkedRole): string {
  const params = new URLSearchParams();
  params.set("company", b.company);
  params.set("role", b.role);
  if (b.location) params.set("location", b.location);
  if (b.function) params.set("function", b.function);
  if (b.level) params.set("level", b.level);
  if (b.reasons.length) params.set("reasons", encodeURIComponent(JSON.stringify(b.reasons)));
  return params.toString();
}
