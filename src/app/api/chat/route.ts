import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ingestSpan, readPrompt } from "@/lib/ingest";
import { lookupCrm, lookupInventory, parseOrderNo, parseSku } from "@/lib/lookups";

const MODEL = "openai/gpt-4o";

const SYSTEM_PROMPT = [
  "You are Kiln, writing customer-support replies that a human can send as-is.",
  "Every reply must be long enough to stand alone — aim for 8 to 12 sentences of prose, no bullet points.",
  "Follow every rule below. Do not skip any:",
  "- Greet the customer by name if one is inferable from the ticket.",
  "- Open with a specific acknowledgement of what went wrong, in their words.",
  "- Restate the issue in your own words so they know we read the ticket.",
  "- Quote warehouse hours and the bin / ETA from the enrichment notes when present.",
  "- Give a concrete next step with a timeline (24h, 48h, or 72h).",
  "- Offer two alternative resolutions so the customer can choose.",
  "- Include a short apology paragraph if the incident is our fault.",
  "- Mention shipping policy: standard ground 3–5 days, replacements ship after inspection.",
  "- Close with an invitation to reply, then sign as 'The Kiln Support Team'.",
  "- British English spelling. Never say you are an AI. Never refuse for lack of access.",
].join("\n");

function shouldFailClosed(prompt: string): boolean {
  const n = parseOrderNo(prompt);
  const lower = prompt.toLowerCase();
  return (n > 0 && n % 4 === 0) || lower.includes("refund") || lower.includes("escalate");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json body required" }, { status: 400 });
  }

  const prompt = readPrompt(body);
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
  let invMs = 0;
  let crmMs = 0;
  let inventoryNote = "";
  let crmNote = "";

  const sku = parseSku(prompt);
  const orderNo = parseOrderNo(prompt);

  const tLlm = Date.now();
  try {
    const tInv = Date.now();
    const inventory = await lookupInventory(sku);
    invMs = Date.now() - tInv;
    inventoryNote = `${inventory.bin} · ${inventory.hours.toUpperCase()} · eta ${inventory.etaDays}d`;

    const tCrm = Date.now();
    const crm = await lookupCrm(orderNo);
    crmMs = Date.now() - tCrm;

    if (shouldFailClosed(prompt)) {
      throw new Error("kiln upstream timeout");
    }

    crmNote = `${crm.customer!.tier} · ${crm.email}`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${prompt}\n\nEnrichment — warehouse ${inventoryNote}. CRM ${crmNote}.`,
        },
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
  const span = {
    "service.version": sha,
    request_id: llmId ?? requestId,
    error: failed ? 1 : 0,
    error_message: failed ? reply : undefined,
  };

  const ingestHttp = await ingestSpan({
    ...span,
    kind: "http",
    name: "POST /api/chat",
    "http.route": "/api/chat",
    latency_ms: httpMs,
  });
  const ingestLlm = await ingestSpan({
    ...span,
    kind: "llm",
    name: model,
    "gen_ai.request.model": model,
    "gen_ai.usage.input_tokens": inputTokens,
    "gen_ai.usage.output_tokens": outputTokens,
    latency_ms: llmMs,
  });
  const ingestInv = await ingestSpan({
    ...span,
    kind: "function",
    name: "lookupInventory",
    "code.function": "lookupInventory",
    latency_ms: invMs,
  });
  const ingestCrm = await ingestSpan({
    ...span,
    kind: "function",
    name: "lookupCrm",
    "code.function": "lookupCrm",
    latency_ms: crmMs,
  });
  const ingestOk = ingestHttp && ingestLlm && ingestInv && ingestCrm;

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
