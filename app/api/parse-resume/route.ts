import path from "path";
import { pathToFileURL } from "url";
import { NextResponse } from "next/server";
import { parseResumeText } from "@/lib/resume-parser";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface PdfTextItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  width: number;
  height: number;
}

/**
 * Extract text from a PDF, reconstructing line breaks from y-coordinate
 * positions so the resume parser can find section headers and entries.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import(
    /* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs"
  ) as typeof import("pdfjs-dist");

  GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;

  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items = (content.items as unknown[]).filter(
      (item): item is PdfTextItem => typeof item === "object" && item !== null && "str" in item && typeof (item as PdfTextItem).str === "string" && Array.isArray((item as PdfTextItem).transform)
    );

    if (items.length === 0) continue;

    // Sort by y descending (top of page first), then x ascending
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    // Group into lines: new line when y changes by more than 3 pts
    const lines: string[] = [];
    let currentLine: string[] = [];
    let lastY: number | null = null;

    for (const item of items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        const lineText = currentLine.join(" ").trim();
        if (lineText) lines.push(lineText);
        currentLine = [];
      }
      if (item.str.trim()) currentLine.push(item.str);
      lastY = y;
    }
    if (currentLine.length) {
      const lineText = currentLine.join(" ").trim();
      if (lineText) lines.push(lineText);
    }

    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("resume");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum 5 MB." }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPdf && !isTxt) {
      return NextResponse.json({ error: "Only PDF and TXT files are supported." }, { status: 400 });
    }

    let text: string;
    if (isTxt) {
      text = await file.text();
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractPdfText(buffer);
    }

    const jobs = parseResumeText(text);
    if (jobs.length === 0) {
      return NextResponse.json(
        { error: "Could not extract job history from your resume. Try uploading as a .txt file, or enter your roles manually." },
        { status: 422 }
      );
    }
    return NextResponse.json({ jobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
