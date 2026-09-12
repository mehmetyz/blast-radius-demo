import { NextResponse } from "next/server";
import { lookupCrm } from "@/lib/lookups";

export async function GET(req: Request) {
  const order = Number(new URL(req.url).searchParams.get("order") ?? "");
  try {
    const record = await lookupCrm(order);
    const email = record.customer!.email;
    return NextResponse.json({ ...record, email });
  } catch {
    return NextResponse.json({ error: "crm circuit open", order }, { status: 500 });
  }
}
