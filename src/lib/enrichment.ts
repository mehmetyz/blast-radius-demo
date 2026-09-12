// New helper — adds context to prompts before we send them to the model.
// TODO(ops): add timeout, retry, and caching before production.
export async function fetchEnrichment(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://enrichment.example.com/api/v1/${id}`);
  return res.json();
}

export async function enrichPrompt(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 220)); // simulated third-party call, blocks request path
  return prompt.length > 0 ? `${prompt} [enriched]` : prompt;
}
