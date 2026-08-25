import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";
import { DEMO_DRIVER_ID, DEMO_VEHICLE_ID } from "./constants";

// ---------------------------------------------------------------------------
// SQLite for local dev — swap to Postgres (e.g. Supabase) for production by
// changing this file only; every query elsewhere goes through `db` from
// drizzle-orm and doesn't care which engine is underneath. See the build
// spec doc, section 2, for the reasoning.
//
// Uses @libsql/client rather than better-sqlite3: it ships prebuilt native
// binaries (no node-gyp/MSBuild compile step needed), which matters on
// machines without a working native build toolchain.
//
// Cached unconditionally on globalThis (not just in dev): Next.js can load
// this module more than once in the same process — across hot reloads, but
// also across separate route bundles and `next build`'s parallel static-page
// workers — and each load's `init()` opens its own connection to the same
// file. Without a shared client + a single in-flight `ready` promise,
// concurrent CREATE TABLE / seed writes from those separate instances can
// collide with SQLITE_BUSY.
// ---------------------------------------------------------------------------

declare global {
  var __taxiPayClient: Client | undefined;
  var __taxiPayReady: Promise<void> | undefined;
}

const dbPath = path.join(process.cwd(), "taxi-pay.db");

const client = globalThis.__taxiPayClient ?? createClient({ url: `file:${dbPath}` });
globalThis.__taxiPayClient = client;

export const db = drizzle(client, { schema });

async function init() {
  // WAL mode + a busy timeout so concurrent connections queue and retry
  // instead of failing immediately with "database is locked".
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      registration TEXT NOT NULL,
      route TEXT NOT NULL,
      driver_id TEXT NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      driver_id TEXT NOT NULL REFERENCES users(id),
      rider_ref TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS wallets (
      driver_id TEXT PRIMARY KEY REFERENCES users(id),
      balance REAL NOT NULL DEFAULT 0,
      cashed_out REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      driver_id TEXT PRIMARY KEY REFERENCES users(id),
      bank_name TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      account_number TEXT NOT NULL,
      branch_code TEXT NOT NULL,
      account_type TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      bank_name TEXT NOT NULL,
      account_last4 TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await seed();
}

// Seed one demo driver + vehicle + wallet so the /driver page works
// immediately with no signup flow — this is a prototype, not the real
// phone+OTP auth described in the build spec. `INSERT OR IGNORE` (rather
// than a SELECT-then-INSERT check) keeps this safe if multiple connections
// race to seed at once.
async function seed() {
  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)",
    args: [DEMO_DRIVER_ID, "+27821234567", "Sipho Ndlovu", "DRIVER"],
  });

  await client.execute({
    sql: "INSERT OR IGNORE INTO vehicles (id, registration, route, driver_id) VALUES (?, ?, ?, ?)",
    args: [DEMO_VEHICLE_ID, "CA 123-456", "Mitchells Plain ↔ Cape Town CBD", DEMO_DRIVER_ID],
  });

  await client.execute({
    sql: "INSERT OR IGNORE INTO wallets (driver_id, balance, cashed_out) VALUES (?, 0, 0)",
    args: [DEMO_DRIVER_ID],
  });
}

// Cached across hot reloads and separate module instances so every query
// can just `await ready` before touching the database, without re-running
// (or racing) init.
export const ready = globalThis.__taxiPayReady ?? init();
globalThis.__taxiPayReady = ready;
