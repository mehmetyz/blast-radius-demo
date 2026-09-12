import { NextResponse } from "next/server";
import OpenAI from "openai";

const MODEL = "openai/gpt-4o";

function everyFourthOrderFails(prompt: string): boolean {
  const n = Number(/#(\d+)/.exec(prompt)?.[1] ?? "0");
  return n > 0 && n % 4 === 0;
}

async function ingestSpan(body: Record<string, unknown>) {
  const ingestUrl = process.env.INGEST_URL;
  const ingestToken = process.env.INGEST_TOKEN;
  if (!ingestUrl || !ingestToken) return false;
  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ingestToken}`,
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  const sha = process.env.SERVICE_VERSION ?? "dev";
  const requestId = crypto.randomUUID();
  const tReq = Date.now();
  let reply = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let model = MODEL;
  let llmId: string | null = null;
  let failed = false;
  let llmMs = 0;

  const tLlm = Date.now();
  try {
    const first = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You write customer-support replies. Include shipping policy, warehouse hours, and a long apology. No preamble.",
        },
        { role: "user", content: prompt },
      ],
    });
    const second = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "Tighten the previous draft to one sentence. Keep every concrete detail.",
        },
        { role: "user", content: first.choices[0]?.message?.content ?? prompt },
      ],
    });
    llmMs = Date.now() - tLlm;
    reply = second.choices[0]?.message?.content ?? first.choices[0]?.message?.content ?? "";
    inputTokens =
      (first.usage?.prompt_tokens ?? 0) + (second.usage?.prompt_tokens ?? 0);
    outputTokens =
      (first.usage?.completion_tokens ?? 0) + (second.usage?.completion_tokens ?? 0);
    model = second.model ?? first.model ?? MODEL;
    llmId = second.id ?? first.id ?? null;
    if (everyFourthOrderFails(prompt)) {
      failed = true;
      reply = "kiln upstream timeout";
    }
  } catch (err) {
    llmMs = Date.now() - tLlm;
    failed = true;
    reply = err instanceof Error ? err.message : "model call failed";
  }

  const httpMs = Date.now() - tReq;
  const common = {
    "service.version": sha,
    error: failed ? 1 : 0,
    error_message: failed ? reply : undefined,
    request_id: llmId ?? requestId,
  };

  const ingestHttp = await ingestSpan({
    ...common,
    kind: "http",
    name: "POST /api/chat",
    "http.route": "/api/chat",
    latency_ms: httpMs,
  });
  const ingestLlm = await ingestSpan({
    ...common,
    kind: "llm",
    name: model,
    "gen_ai.request.model": model,
    "gen_ai.usage.input_tokens": inputTokens,
    "gen_ai.usage.output_tokens": outputTokens,
    latency_ms: llmMs,
  });
  const ingestOk = ingestHttp && ingestLlm;

  if (failed) {
    return NextResponse.json({ error: reply, ingest_ok: ingestOk, sha }, { status: 502 });
  }

  return NextResponse.json({
    reply,
    model,
    sha,
    ingest_ok: ingestOk,
  });
}
