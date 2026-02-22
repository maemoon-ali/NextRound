import { NextRequest, NextResponse } from "next/server";

/** Try primary URL (e.g. Clearbit); on failure try Google favicon for that domain. */
async function fetchLogo(url: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MockInterviewPrep/1.0)" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") ?? "image/png";
      return { body, contentType };
    }
  } catch {
    // fall through to favicon
  }

  // Fallback: Google favicon by domain (works when Clearbit is blocked/down)
  let domain: string | null = null;
  try {
    const u = new URL(url);
    if (u.hostname === "logo.clearbit.com" && u.pathname) {
      domain = u.pathname.replace(/^\//, "").trim() || null;
    }
  } catch {
    //
  }
  if (domain) {
    try {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const res = await fetch(faviconUrl, { cache: "no-store" });
      if (res.ok) {
        const body = await res.arrayBuffer();
        return { body, contentType: "image/png" };
      }
    } catch {
      //
    }
  }
  return null;
}

/**
 * Proxy company logos. GET /api/logo?url=... or /api/logo?company=Stripe
 * Tries primary URL; on failure uses Google favicon for the domain so logos always load.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const company = request.nextUrl.searchParams.get("company");
  let targetUrl = url;

  if (!targetUrl && company) {
    const { COMPANY_LOGOS } = await import("@/lib/mock-livedata");
    const name = company.trim();
    targetUrl = name ? COMPANY_LOGOS[name] ?? null : null;
    if (!targetUrl && name) {
      const domain = name.toLowerCase().replace(/\s+/g, "") + ".com";
      targetUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return NextResponse.json({ error: "Missing url or company" }, { status: 400 });
  }

  const result = await fetchLogo(targetUrl);
  if (!result) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(result.body, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
