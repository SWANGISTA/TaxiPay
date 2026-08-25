import { NextResponse } from "next/server";
import { getBankAccount, saveBankAccount } from "@/lib/queries";
import { DEMO_DRIVER_ID } from "@/lib/constants";

// Returns only the masked view (bank, holder name, last 4 digits) — the
// full account number is never sent back to the client once saved.
export async function GET() {
  return NextResponse.json(await getBankAccount(DEMO_DRIVER_ID));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await saveBankAccount(DEMO_DRIVER_ID, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(await getBankAccount(DEMO_DRIVER_ID));
}
