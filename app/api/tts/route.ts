import { NextResponse } from "next/server";

const ELEVEN_LABS_API = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel – professional, clear

export async function POST(request: Request) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TTS not configured. Set ELEVEN_LABS_API_KEY." },
      { status: 503 }
    );
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const voiceId = process.env.ELEVEN_LABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  try {
    const res = await fetch(`${ELEVEN_LABS_API}/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[api/tts] Eleven Labs error:", res.status, err);
      return NextResponse.json(
        { error: "TTS request failed" },
        { status: res.status }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/tts]", e);
    return NextResponse.json(
      { error: "TTS failed" },
      { status: 500 }
    );
  }
}
