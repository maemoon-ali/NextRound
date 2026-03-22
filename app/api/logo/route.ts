import { NextRequest, NextResponse } from "next/server";
import { COMPANY_DOMAINS } from "@/lib/company-domains";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; NextRound/1.0)" };
const FETCH_TIMEOUT_MS = 5000;

// Optional: set LOGO_DEV_TOKEN in .env.local for best-quality logos
// Sign up free at https://logo.dev — 500 requests/month on the free tier
const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN ?? "";

// Cache successful results in memory for the lifetime of the server process
const memCache = new Map<string, { body: ArrayBuffer; contentType: string }>();

/**
 * Detect the real image content type from the first few magic bytes.
 * Needed because some sources (e.g. UpLead) return images with wrong MIME types.
 */
function sniffContentType(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf.slice(0, 16));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  // ICO (Windows icon)
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return "image/x-icon";
  // WebP: RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[4] === 0x57 && b[5] === 0x45) return "image/webp";
  // SVG
  const text = new TextDecoder().decode(buf.slice(0, 64));
  if (text.includes("<svg") || text.includes("<?xml")) return "image/svg+xml";
  return "image/png";
}

/**
 * Fetch a URL and throw on failure so Promise.any can skip it.
 */
async function tryFetch(url: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawContentType = res.headers.get("content-type") ?? "";
    if (rawContentType.includes("text/html")) throw new Error("HTML response");
    const body = await res.arrayBuffer();
    if (body.byteLength < 200) throw new Error("Too small");
    // Always sniff the real type — some sources lie about content-type
    const contentType = sniffContentType(body);
    // Reject if sniffed type is not an image (e.g. HTML disguised as something else)
    if (!contentType.startsWith("image/")) throw new Error("Not an image");
    return { body, contentType };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}


function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|llp|plc|group|holdings|co|company|the|and|&)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupDomain(name: string): string | null {
  const key = normalise(name);
  if (COMPANY_DOMAINS[key]) return COMPANY_DOMAINS[key];

  const noSpace = key.replace(/\s/g, "");
  if (COMPANY_DOMAINS[noSpace]) return COMPANY_DOMAINS[noSpace];

  const firstWord = key.split(" ")[0];
  if (firstWord && firstWord.length > 2 && COMPANY_DOMAINS[firstWord]) return COMPANY_DOMAINS[firstWord];

  const firstTwo = key.split(" ").slice(0, 2).join(" ");
  if (COMPANY_DOMAINS[firstTwo]) return COMPANY_DOMAINS[firstTwo];

  for (const [k, v] of Object.entries(COMPANY_DOMAINS)) {
    if (key.startsWith(k) && k.length >= 4) return v;
    if (k.startsWith(key) && key.length >= 4) return v;
  }
  return null;
}

function inferDomains(name: string): string[] {
  const cleaned = normalise(name);
  const slug = cleaned.replace(/\s+/g, "");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const domains: string[] = [];
  if (slug) domains.push(`${slug}.com`);
  if (words.length >= 2) domains.push(`${words[0]}${words[1]}.com`);
  if (words[0] && words[0].length > 2) domains.push(`${words[0]}.com`);
  return [...new Set(domains)];
}

/**
 * GET /api/logo?domain=stripe.com   — exact domain
 * GET /api/logo?company=Stripe      — curated map lookup + inference
 *
 * All sources fetched IN PARALLEL — first valid image wins.
 * Cached in memory for server lifetime + 7 days browser/CDN cache.
 */
export async function GET(request: NextRequest) {
  const domainParam = request.nextUrl.searchParams.get("domain")?.trim();
  const company    = request.nextUrl.searchParams.get("company")?.trim();

  let domainsToTry: string[] = [];

  if (domainParam) {
    domainsToTry = [domainParam];
  } else if (company) {
    const known = lookupDomain(company);
    domainsToTry = known ? [known] : inferDomains(company);
  } else {
    return NextResponse.json({ error: "Missing domain or company" }, { status: 400 });
  }

  const cacheKey = domainsToTry.join("|");
  const cached = memCache.get(cacheKey);
  if (cached) {
    return new NextResponse(cached.body, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=604800",
        "X-Logo-Cache": "HIT",
      },
    });
  }

  // Stage 1 — high-quality sources in parallel (Logo.dev + UpLead)
  const highQualityUrls: string[] = [];
  for (const d of domainsToTry) {
    const domain = d.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];
    if (LOGO_DEV_TOKEN) {
      highQualityUrls.push(`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=200&format=png`);
      highQualityUrls.push(`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`);
    }
    highQualityUrls.push(`https://logo.uplead.com/${domain}`);
  }

  // Stage 2 — favicon fallbacks (always return something, lower quality)
  const fallbackUrls: string[] = [];
  for (const d of domainsToTry) {
    const domain = d.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];
    fallbackUrls.push(
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`
    );
    fallbackUrls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
  }

  // Try high-quality first; only use favicon if every HQ source fails
  const stages = [highQualityUrls, fallbackUrls];
  for (const urls of stages) {
    if (urls.length === 0) continue;
    try {
      const result = await Promise.any(urls.map((url) => tryFetch(url)));
      memCache.set(cacheKey, result);
      return new NextResponse(result.body, {
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control": "public, max-age=604800",
        },
      });
    } catch {
      // All URLs in this stage failed — move to next stage
    }
  }

  return new NextResponse(null, { status: 404 });
}
