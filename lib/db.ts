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
// ---------------------------------------------------------------------------

declare global {
  var __taxiPayClient: Client | undefined;
  var __taxiPayReady: Promise<void> | undefined;
}

const dbPath = path.join(process.cwd(), "taxi-pay.db");

const client = globalThis.__taxiPayClient ?? createClient({ url: `file:${dbPath}` });
if (process.env.NODE_ENV !== "production") {
  globalThis.__taxiPayClient = client;
}

export const db = drizzle(client, { schema });

async function init() {
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
  `);

  await seed();
}

// Seed one demo driver + vehicle + wallet so the /driver page works
// immediately with no signup flow — this is a prototype, not the real
// phone+OTP auth described in the build spec.
async function seed() {
  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: [DEMO_DRIVER_ID],
  });
  if (existing.rows.length) return;

  await client.execute({
    sql: "INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)",
    args: [DEMO_DRIVER_ID, "+27821234567", "Sipho Ndlovu", "DRIVER"],
  });

  await client.execute({
    sql: "INSERT INTO vehicles (id, registration, route, driver_id) VALUES (?, ?, ?, ?)",
    args: [DEMO_VEHICLE_ID, "CA 123-456", "Mitchells Plain ↔ Cape Town CBD", DEMO_DRIVER_ID],
  });

  await client.execute({
    sql: "INSERT INTO wallets (driver_id, balance, cashed_out) VALUES (?, 0, 0)",
    args: [DEMO_DRIVER_ID],
  });
}

// Cached across hot reloads / route invocations so every query can just
// `await ready` before touching the database, without re-running init.
export const ready = globalThis.__taxiPayReady ?? init();
if (process.env.NODE_ENV !== "production") {
  globalThis.__taxiPayReady = ready;
}
