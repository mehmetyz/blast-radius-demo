export async function ingestSpan(body: Record<string, unknown>) {
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

export function commonSpan(extra: Record<string, unknown>) {
  return {
    "service.version": process.env.SERVICE_VERSION ?? "dev",
    request_id: crypto.randomUUID(),
    ...extra,
  };
}
