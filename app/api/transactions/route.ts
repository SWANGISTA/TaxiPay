import { NextResponse } from "next/server";
import { createTransaction } from "@/lib/queries";

// Driver's device calls this from /driver after entering a fare amount —
// creates a PENDING transaction that the QR code then points at.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);

  const result = await createTransaction(amount);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
