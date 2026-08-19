import { NextResponse } from "next/server";
import { getTransaction } from "@/lib/queries";

// Polled by both the rider's /pay page (to show the fare) and the driver's
// dashboard (to detect when a PENDING transaction has been paid).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txn = await getTransaction(id);
  if (!txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  return NextResponse.json(txn);
}
