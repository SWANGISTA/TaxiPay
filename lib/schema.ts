import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Data model for the cashless minibus taxi payment prototype.
// Kept deliberately small — see the build spec doc, section 3, for what's
// intentionally NOT modeled yet (routes, operators, payouts) and why.
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["RIDER", "DRIVER", "OWNER"] }).notNull(),
});

export const vehicles = sqliteTable("vehicles", {
  id: text("id").primaryKey(),
  registration: text("registration").notNull(),
  route: text("route").notNull(),
  driverId: text("driver_id")
    .notNull()
    .references(() => users.id),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  driverId: text("driver_id")
    .notNull()
    .references(() => users.id),
  riderRef: text("rider_ref"), // payment provider reference once paid
  amount: real("amount").notNull(),
  status: text("status", { enum: ["PENDING", "PAID", "FAILED"] })
    .notNull()
    .default("PENDING"),
  createdAt: integer("created_at").notNull(),
  paidAt: integer("paid_at"),
});

export const wallets = sqliteTable("wallets", {
  driverId: text("driver_id")
    .primaryKey()
    .references(() => users.id),
  balance: real("balance").notNull().default(0),
  cashedOut: real("cashed_out").notNull().default(0),
});

// One bank account per driver (prototype scope — no support for multiple
// accounts yet). `accountNumber` is stored in full so a real payout could
// use it later, but it's never sent back to the client in full — API
// responses only ever expose the last 4 digits. See build spec §7 (POPIA,
// data minimisation).
export const bankAccounts = sqliteTable("bank_accounts", {
  driverId: text("driver_id")
    .primaryKey()
    .references(() => users.id),
  bankName: text("bank_name").notNull(),
  accountHolder: text("account_holder").notNull(),
  accountNumber: text("account_number").notNull(),
  branchCode: text("branch_code").notNull(),
  accountType: text("account_type", { enum: ["SAVINGS", "CHEQUE"] }).notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// A settlement record for each cash-out — the "Payout" entity the build
// spec (§3) describes as modeled but not built in the original prototype.
// Snapshots the destination bank/last4 at the time of payout, so the
// history stays meaningful even if the driver later changes their account.
// Still fully simulated — see lib/payment-provider.ts and build spec §6 for
// why a prototype can't move real money to a real bank account.
export const payouts = sqliteTable("payouts", {
  id: text("id").primaryKey(),
  driverId: text("driver_id")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  bankName: text("bank_name").notNull(),
  accountLast4: text("account_last4").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
