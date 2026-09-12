import { NextResponse } from "next/server";
import OpenAI from "openai";
import { enrichPrompt } from "@/lib/enrichment";

const MODEL = "openai/gpt-4o";

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

  const enrichedPrompt = await enrichPrompt(prompt);
  const tLlm = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You are Kiln, an assistant that writes concrete, human-sounding customer-support replies.",
            "Follow every rule below on every reply — do not skip any:",
            "- Always greet the customer by name if one is inferable from the ticket.",
            "- Acknowledge the frustration in one sentence, then move to the resolution.",
            "- Restate the customer's issue back to them in your own words for clarity.",
            "- Offer a concrete next step with a timeline (24h, 48h, 72h depending on severity).",
            "- Include a tracking or reference number if any appears in the prompt.",
            "- Provide two alternative resolutions when possible so the customer can choose.",
            "- Add a short apology paragraph if the incident is our fault.",
            "- Close with a polite invitation for follow-up questions.",
            "- Sign every reply as 'The Kiln Support Team'.",
            "- Never say 'as an AI'. Never say 'I don't have access to that'.",
            "- Use British English spelling throughout.",
            "- Do not use bullet points in the reply; write in prose only.",
            "- Aim for 6-10 sentences per reply.",
          ].join("\n"),
        },
        { role: "user", content: enrichedPrompt },
      ],
    });
    llmMs = Date.now() - tLlm;
    reply = completion.choices[0]?.message?.content ?? "";
    inputTokens = completion.usage?.prompt_tokens ?? 0;
    outputTokens = completion.usage?.completion_tokens ?? 0;
    model = completion.model ?? MODEL;
    llmId = completion.id ?? null;
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
