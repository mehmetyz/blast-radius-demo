export async function ingestSpan(body: Record<string, unknown>): Promise<boolean> {
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

export function readPrompt(body: unknown): string {
  if (typeof body !== "object" || body === null || !("prompt" in body)) return "";
  const value = body.prompt;
  return typeof value === "string" ? value.trim() : "";
}
