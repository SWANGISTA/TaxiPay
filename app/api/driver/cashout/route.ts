import { NextResponse } from "next/server";
import { cashOut, getDriverSummary } from "@/lib/queries";

// Stands in for "instant payout to the driver's own bank account" — the
// feature the build spec flags as the actual make-or-break of this idea
// (see section 5). Still fully simulated: no real transfer happens, this
// just records which (fake) account the money would have gone to. Requires
// a bank account on file — see /api/driver/bank-account.
export async function POST() {
  const result = await cashOut();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ payout: result, ...(await getDriverSummary()) });
}
