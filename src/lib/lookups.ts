export const INVENTORY_DELAY_MS = 420;
export const CRM_DELAY_MS = 360;

const CATALOG: Record<string, { bin: string; hours: string }> = {
  "KILN-GLAZE": { bin: "A-12", hours: "Mon–Fri 08:00–16:00 CET" },
  "KILN-CLAY": { bin: "B-04", hours: "Mon–Fri 08:00–16:00 CET" },
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseOrderNo(prompt: string): number {
  return Number((/#(\d+)/.exec(prompt) ?? [])[1] ?? 0);
}

export function parseSku(prompt: string): string {
  return (/SKU[- ]?([A-Z0-9-]+)/i.exec(prompt)?.[1] ?? "KILN-GLAZE").toUpperCase();
}

export async function lookupInventory(sku: string) {
  await sleep(INVENTORY_DELAY_MS);
  const item = CATALOG[sku];
  return { sku, bin: item.bin, hours: item.hours, etaDays: 3 };
}

export async function lookupCrm(orderNo: number) {
  await sleep(CRM_DELAY_MS);
  if (!Number.isFinite(orderNo) || orderNo <= 0) {
    return { order: orderNo, customer: null as { email: string; tier: string } | null, email: "", tier: "" };
  }
  const customer = { email: "pat@example.com", tier: "standard" };
  return { order: orderNo, customer, email: customer.email, tier: customer.tier };
}
