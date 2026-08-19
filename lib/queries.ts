import { eq, sql } from "drizzle-orm";
import { db, ready } from "./db";
import { transactions, wallets, type Transaction } from "./schema";
import { DEMO_DRIVER_ID, DEMO_VEHICLE_ID } from "./constants";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Small business-logic layer between the API routes and the database, so
// route handlers stay thin and the rules (e.g. "a fare must be R1-R500")
// live in one place.
// ---------------------------------------------------------------------------

const MIN_FARE = 1;
const MAX_FARE = 500;

export async function createTransaction(
  amount: number
): Promise<{ id: string } | { error: string }> {
  if (!Number.isFinite(amount) || amount < MIN_FARE || amount > MAX_FARE) {
    return { error: `Enter a fare between R${MIN_FARE} and R${MAX_FARE}` };
  }
  await ready;
  const id = nanoid(10);
  await db.insert(transactions).values({
    id,
    vehicleId: DEMO_VEHICLE_ID,
    driverId: DEMO_DRIVER_ID,
    amount,
    status: "PENDING",
    createdAt: Date.now(),
  });
  return { id };
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  await ready;
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

export async function markPaid(id: string, reference: string) {
  await ready;
  const txn = await getTransaction(id);
  if (!txn) return;

  await db
    .update(transactions)
    .set({ status: "PAID", paidAt: Date.now(), riderRef: reference })
    .where(eq(transactions.id, id));

  await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${txn.amount}` })
    .where(eq(wallets.driverId, txn.driverId));
}

export async function markFailed(id: string) {
  await ready;
  await db.update(transactions).set({ status: "FAILED" }).where(eq(transactions.id, id));
}

export async function getDriverSummary(driverId: string = DEMO_DRIVER_ID) {
  await ready;
  const wallet = await db.select().from(wallets).where(eq(wallets.driverId, driverId)).get();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const all = (await db.select().from(transactions).where(eq(transactions.driverId, driverId)).all()).sort(
    (a, b) => b.createdAt - a.createdAt
  );

  const today = all.filter((t) => t.createdAt >= startOfDay.getTime());
  const paidToday = today.filter((t) => t.status === "PAID");
  const totalToday = paidToday.reduce((sum, t) => sum + t.amount, 0);

  return {
    balance: wallet?.balance ?? 0,
    cashedOut: wallet?.cashedOut ?? 0,
    totalToday,
    ridesToday: paidToday.length,
    recent: all.slice(0, 15),
  };
}

export async function cashOut(driverId: string = DEMO_DRIVER_ID) {
  await ready;
  const wallet = await db.select().from(wallets).where(eq(wallets.driverId, driverId)).get();
  if (!wallet || wallet.balance <= 0) return;

  await db
    .update(wallets)
    .set({
      cashedOut: sql`${wallets.cashedOut} + ${wallets.balance}`,
      balance: 0,
    })
    .where(eq(wallets.driverId, driverId));
}
