import path from "path";
import { pathToFileURL } from "url";
import { NextResponse } from "next/server";
import { parseResumeText } from "@/lib/resume-parser";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["application/pdf", "text/plain"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("resume");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Use form field 'file' or 'resume'." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 400 });
    }

    const type = file.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(type) && !file.name.toLowerCase().endsWith(".pdf") && !file.name.toLowerCase().endsWith(".txt")) {
      return NextResponse.json({ error: "Only PDF and TXT files are supported." }, { status: 400 });
    }

    let text: string;
    if (type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      text = await file.text();
    } else {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { PDFParse } = await import("pdf-parse");
      const workerPath = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
      PDFParse.setWorker(pathToFileURL(workerPath).href);
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result?.text ?? "";
      } finally {
        await parser.destroy();
      }
    }

    const jobs = parseResumeText(text);
    return NextResponse.json({ jobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
