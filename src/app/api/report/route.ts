import { NextResponse } from "next/server";
import { ingestSpan } from "../../../lib/telemetry";
import { formatItemLine } from "../../../lib/format";

// Heavy endpoint — simulates a daily report build (~2.5s of blocking work)
// on the request path, before the response is sent.
export async function POST(req: Request) {
  const sha = process.env.SERVICE_VERSION ?? "dev";
  const requestId = crypto.randomUUID();
  const t0 = Date.now();

  let items: { name?: string; qty?: number }[] = [];
  try {
    const body = (await req.json()) as { items?: { name?: string; qty?: number }[] };
    items = Array.isArray(body?.items) ? body.items : [];
  } catch {
    return NextResponse.json({ error: "json body required" }, { status: 400 });
  }

  const tWork = Date.now();
  let summary = "";
  try {
    // Simulated report build: aggregation + formatting across items.
    let total = 0;
    const lines: string[] = [];
    for (const item of items) {
      total += item.qty ?? 0;
      lines.push(formatItemLine(item));
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
    summary = `${items.length} line items (${lines.length} formatted), ${total} units total`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "report build failed";
    const ms = Date.now() - t0;
    await ingestSpan({
      "service.version": sha,
      kind: "http",
      name: "POST /api/report",
      "http.route": "/api/report",
      latency_ms: ms,
      error: 1,
      error_message: message,
      request_id: requestId,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const workMs = Date.now() - tWork;

  const httpMs = Date.now() - t0;
  await ingestSpan({
    "service.version": sha,
    kind: "function",
    name: "buildReport",
    "code.function": "buildReport",
    latency_ms: workMs,
    error: 0,
    request_id: requestId,
  });
  await ingestSpan({
    "service.version": sha,
    kind: "http",
    name: "POST /api/report",
    "http.route": "/api/report",
    latency_ms: httpMs,
    error: 0,
    request_id: requestId,
  });
  return NextResponse.json({ summary, items: items.length, latency_ms: httpMs, sha });
}
