import { NextResponse } from "next/server";
import { getTransaction, markPaid, markFailed } from "@/lib/queries";
import { paymentProvider } from "@/lib/payment-provider";

// Rider's device calls this after tapping "Pay now" — this is where a real
// build would call out to PayShap / a PSP instead of MockPaymentProvider.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txn = await getTransaction(id);

  if (!txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  if (txn.status !== "PENDING") {
    return NextResponse.json(
      { error: `This fare was already ${txn.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  const result = await paymentProvider.charge({ amount: txn.amount, transactionId: id });

  if (result.success) {
    await markPaid(id, result.reference);
  } else {
    await markFailed(id);
  }

  return NextResponse.json({
    status: result.success ? "PAID" : "FAILED",
    message: result.message,
    reference: result.reference,
  });
}
