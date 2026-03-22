import { NextResponse } from "next/server";
import { getCompanyMetaFromApi } from "@/lib/livedata-api";

type DifficultyLevel = "Easier" | "Moderate" | "Competitive" | "Very competitive";

function inferCareersUrl(domain?: string, companyName?: string): string | null {
  const d = (domain ?? "").trim();
  if (d && d.includes(".")) return `https://${d}/careers`;
  const name = (companyName ?? "").trim();
  if (!name) return null;
  const fallbackDomain = name.toLowerCase().replace(/\s+/g, "") + ".com";
  return `https://www.${fallbackDomain}/careers`;
}

function inferDifficulty(meta: {
  roles_matching_filters: number;
  roles_at_company: number;
}): { level: DifficultyLevel; note: string } {
  const total = Math.max(1, meta.roles_at_company);
  const ratio = meta.roles_matching_filters / total;
  if (ratio < 0.05)
    return { level: "Very competitive", note: "This combination of level/function appears rarely for this company." };
  if (ratio < 0.12)
    return { level: "Competitive", note: "This level/function combination is uncommon at this company." };
  if (ratio < 0.25)
    return { level: "Moderate", note: "This level/function combination appears with moderate frequency at this company." };
  return { level: "Easier", note: "This level/function combination appears frequently at this company." };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim() ?? "";
  const function_ = searchParams.get("function")?.trim() ?? "";
  const level = searchParams.get("level")?.trim() ?? "";

  if (!company) {
    return NextResponse.json({ error: "Missing company" }, { status: 400 });
  }

  try {
    const meta = await getCompanyMetaFromApi(company, {
      function: function_ || undefined,
      level: level || undefined,
    });

    if (!meta) {
      return NextResponse.json({ error: "Company not found in LiveData." }, { status: 404 });
    }

    const difficulty = inferDifficulty(meta);
    const careers_url = inferCareersUrl(meta.domain, meta.name);

    return NextResponse.json({
      company: meta.name,
      domain: meta.domain ?? null,
      industry: meta.industry ?? null,
      employee_count: meta.employee_count ?? null,
      countries: meta.countries,
      profiles_in_dataset: meta.profiles_in_dataset,
      roles_at_company: meta.roles_at_company,
      roles_matching_filters: meta.roles_matching_filters,
      top_titles: meta.top_titles,
      top_titles_matching_filters: meta.top_titles_matching_filters,
      careers_url,
      difficulty,
    });
  } catch (e) {
    console.error("[api/company-meta]", e);
    return NextResponse.json({ error: "Failed to fetch company data." }, { status: 500 });
  }
}
