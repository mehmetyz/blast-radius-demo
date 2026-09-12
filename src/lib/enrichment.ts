// Enrichment adds account and prior-ticket context before the LLM call.
// TODO(ops): add timeout, retry, and caching before production.
export async function enrichPrompt(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 220)); // simulated third-party call
  return prompt.length > 0 ? `${prompt} [enriched]` : prompt;
}
