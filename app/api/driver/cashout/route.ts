import { NextResponse } from "next/server";
import { cashOut, getDriverSummary } from "@/lib/queries";

// Stands in for "instant payout to the driver's own wallet/bank" — the
// feature the build spec flags as the actual make-or-break of this idea
// (see section 5). Here it just zeroes the in-app balance.
export async function POST() {
  await cashOut();
  return NextResponse.json(await getDriverSummary());
}
