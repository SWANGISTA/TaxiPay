import { NextResponse } from "next/server";
import { getDriverSummary } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getDriverSummary());
}
