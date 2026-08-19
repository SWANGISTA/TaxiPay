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

export type Transaction = typeof transactions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
