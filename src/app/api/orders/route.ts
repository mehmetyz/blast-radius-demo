import { NextResponse } from "next/server";
import { ingestSpan } from "../../../lib/telemetry";

// Orders lookup with two distinct failure triggers:
//  1. missing `order_id` field → unvalidated access crash (500)
//  2. order_id divisible by 7 → "quarantined" path (503)
export async function GET(req: Request) {
  const sha = process.env.SERVICE_VERSION ?? "dev";
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  const orderIdRaw = url.searchParams.get("order_id");
  const t0 = Date.now();

  let orderId: number | null = null;
  try {
    orderId = orderIdRaw ? Number.parseInt(orderIdRaw, 10) : null;
  } catch {
    orderId = null;
  }

  // Trigger 1: missing field reaches an unguarded code path.
  if (orderId === null || !Number.isFinite(orderId)) {
    const message = `order_id=${orderIdRaw ?? ""} is not a valid order id`;
    await ingestSpan({
      "service.version": sha,
      kind: "http",
      name: "GET /api/orders",
      "http.route": "/api/orders",
      latency_ms: Date.now() - t0,
      error: 1,
      error_message: message,
      request_id: requestId,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Trigger 2: numeric pattern — every 7th order is quarantined.
  if (orderId % 7 === 0) {
    const message = `order ${orderId} is quarantined for review`;
    await ingestSpan({
      "service.version": sha,
      kind: "http",
      name: "GET /api/orders",
      "http.route": "/api/orders",
      latency_ms: Date.now() - t0,
      error: 1,
      error_message: message,
      request_id: requestId,
    });
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const item = { order_id: orderId, status: "shipping", eta_days: (orderId % 5) + 1 };
  await ingestSpan({
    "service.version": sha,
    kind: "http",
    name: "GET /api/orders",
    "http.route": "/api/orders",
    latency_ms: Date.now() - t0,
    error: 0,
    request_id: requestId,
  });
  return NextResponse.json(item);
}
