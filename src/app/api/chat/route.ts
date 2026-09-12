import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json body required" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt: unknown }).prompt).trim()
      : "";

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  // D0: OpenAI stays unwired. D1 will replace this with a real completion + ingest.
  return NextResponse.json({
    reply: `Held in the kiln (model unwired).\n\n${prompt}`,
    unwired: true,
  });
}
