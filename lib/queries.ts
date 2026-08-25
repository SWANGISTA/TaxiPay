import { eq, sql } from "drizzle-orm";
import { db, ready } from "./db";
import { transactions, wallets, bankAccounts, payouts, type Transaction } from "./schema";
import { DEMO_DRIVER_ID, DEMO_VEHICLE_ID, SA_BANKS } from "./constants";
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
    bankAccount: await getBankAccount(driverId),
  };
}

// ---------------------------------------------------------------------------
// Bank accounts + payouts. Still entirely simulated, like the rest of this
// prototype — see lib/payment-provider.ts and build spec §6 for why an
// indie project can't get direct access to a real bank-transfer rail.
// "Cash out" just records who the (fake) money would have gone to.
// ---------------------------------------------------------------------------

function last4(accountNumber: string) {
  return accountNumber.slice(-4);
}

// Never expose the full account number back to the client once saved —
// only enough to confirm "yes, this is the account on file".
export async function getBankAccount(driverId: string = DEMO_DRIVER_ID) {
  await ready;
  const account = await db.select().from(bankAccounts).where(eq(bankAccounts.driverId, driverId)).get();
  if (!account) return null;
  return {
    bankName: account.bankName,
    accountHolder: account.accountHolder,
    accountType: account.accountType,
    last4: last4(account.accountNumber),
    updatedAt: account.updatedAt,
  };
}

export async function saveBankAccount(
  driverId: string,
  input: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
  }
): Promise<{ ok: true } | { error: string }> {
  const bankName = input.bankName?.trim();
  const accountHolder = input.accountHolder?.trim();
  const accountNumber = input.accountNumber?.trim();
  const branchCode = input.branchCode?.trim();
  const accountType = input.accountType?.trim().toUpperCase();

  if (!bankName || !SA_BANKS.includes(bankName as (typeof SA_BANKS)[number])) {
    return { error: "Select a bank." };
  }
  if (!accountHolder || accountHolder.length < 2) {
    return { error: "Enter the account holder's name." };
  }
  if (!/^\d{6,11}$/.test(accountNumber ?? "")) {
    return { error: "Account number should be 6-11 digits." };
  }
  if (!/^\d{4,6}$/.test(branchCode ?? "")) {
    return { error: "Branch code should be 4-6 digits." };
  }
  if (accountType !== "SAVINGS" && accountType !== "CHEQUE") {
    return { error: "Select an account type." };
  }

  await ready;
  await db
    .insert(bankAccounts)
    .values({
      driverId,
      bankName,
      accountHolder,
      accountNumber,
      branchCode,
      accountType,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: bankAccounts.driverId,
      set: { bankName, accountHolder, accountNumber, branchCode, accountType, updatedAt: Date.now() },
    });

  return { ok: true };
}

export async function cashOut(
  driverId: string = DEMO_DRIVER_ID
): Promise<{ amount: number; bankName: string; last4: string } | { error: string }> {
  await ready;
  const wallet = await db.select().from(wallets).where(eq(wallets.driverId, driverId)).get();
  if (!wallet || wallet.balance <= 0) {
    return { error: "Nothing to cash out yet." };
  }

  const account = await db.select().from(bankAccounts).where(eq(bankAccounts.driverId, driverId)).get();
  if (!account) {
    return { error: "Add a bank account before cashing out." };
  }

  const amount = wallet.balance;

  await db
    .update(wallets)
    .set({
      cashedOut: sql`${wallets.cashedOut} + ${wallets.balance}`,
      balance: 0,
    })
    .where(eq(wallets.driverId, driverId));

  await db.insert(payouts).values({
    id: nanoid(10),
    driverId,
    amount,
    bankName: account.bankName,
    accountLast4: last4(account.accountNumber),
    createdAt: Date.now(),
  });

  return { amount, bankName: account.bankName, last4: last4(account.accountNumber) };
}
