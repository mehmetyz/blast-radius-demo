import { NextResponse } from "next/server";
import { ingestSpan } from "../../../lib/telemetry";

// Light endpoint — sub-5ms work, useful as a canary span.
export async function GET(req: Request) {
  const t0 = Date.now();
  const res = NextResponse.json({ ok: true, uptime_s: Math.round(process.uptime()) });
  const latencyMs = Date.now() - t0;
  await ingestSpan({
    "service.version": process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SERVICE_VERSION ?? "dev",
    kind: "http",
    name: "GET /api/health",
    "http.route": "/api/health",
    latency_ms: latencyMs,
    error: 0,
    request_id: crypto.randomUUID(),
  });
  return res;
}
