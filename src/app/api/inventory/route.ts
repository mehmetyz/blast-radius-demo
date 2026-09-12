import { NextResponse } from "next/server";
import { lookupInventory } from "@/lib/lookups";

export async function GET(req: Request) {
  const sku = new URL(req.url).searchParams.get("sku") ?? "KILN-GLAZE";
  try {
    const stock = await lookupInventory(sku);
    return NextResponse.json(stock);
  } catch {
    return NextResponse.json({ error: "inventory lookup failed", sku }, { status: 500 });
  }
}
