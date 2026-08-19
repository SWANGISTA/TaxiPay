# TaxiPay — cashless minibus taxi payment prototype

A working proof-of-concept for tap-to-pay minibus taxi fares in South Africa: the driver generates a QR
code for a fare, the rider scans it with their phone's stock camera (no app install) and pays, and the
driver's dashboard updates the moment payment lands. Payments are simulated by a mock provider — see the
build spec doc for what a production integration looks like, and for the reasoning behind every stack
choice below.

## Stack

- **Next.js 16 (App Router) + TypeScript** — one codebase for both the rider "pay" screen and the driver
  dashboard, no app-store install for riders.
- **Tailwind CSS** for styling.
- **Drizzle ORM + @libsql/client** for local dev (swap the datasource for Postgres/Supabase in
  `lib/db.ts` when this goes further than a prototype — everything else is unaffected). Uses
  `@libsql/client` rather than `better-sqlite3` because it ships prebuilt native binaries, so there's
  no node-gyp/MSBuild compile step on install.
- **`qrcode.react`** to render the fare QR client-side.

## Running it

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

No database setup needed — `lib/db.ts` creates `taxi-pay.db` (a local SQLite file) and seeds one demo
driver automatically the first time the app runs.

## Trying the flow

1. Open `/driver` — this is the demo driver's dashboard.
2. Enter a fare amount and click **Generate QR**.
3. Open the link shown under the QR code in a second browser tab (or scan it with your phone if you're
   running this on your network) — this is the rider's screen.
4. Click **Pay now**. Within a couple of seconds the driver dashboard updates on its own — no refresh
   needed.
5. Try **Cash out** on the driver dashboard — it simulates the same-day payout the build spec flags as the
   actual make-or-break problem for a real version of this (see `TAXI-CASHLESS-PAYMENT-BUILD-SPEC.md`,
   §5).

## Deploying to Render

This repo includes a `render.yaml` Blueprint, so Render can pick up the build/start commands
automatically:

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. In the Render dashboard: **New +** → **Blueprint**, connect this repo, and Render will read
   `render.yaml` and configure the service (build: `npm install && npm run build`, start: `npm start`,
   free plan).
   - Alternatively, without the Blueprint: **New +** → **Web Service**, connect the repo, and set the
     same build/start commands manually — Render auto-detects Node from `package.json`/`.node-version`.
3. Deploy. Render assigns the port via the `PORT` env var, which `next start` reads automatically —
   no extra config needed.

**Data persistence caveat:** the local SQLite-style database (`taxi-pay.db`, via `@libsql/client`) lives
on Render's filesystem, which is **ephemeral on the free plan** — it resets on every redeploy and
whenever the free instance spins down from inactivity and wakes back up. Wallet balances and
transaction history will periodically reset; the demo driver reseeds automatically either way. That's
an acceptable trade-off for a portfolio prototype demo. For persistence, either:
- point `lib/db.ts` at a hosted libsql database (e.g. [Turso](https://turso.tech), which has a free
  tier) — since the app already uses `@libsql/client`, this is a small change to the `createClient` call
  (a remote `url` + `authToken` instead of a local file), or
- attach a [Render persistent disk](https://render.com/docs/disks) (paid instance types only) mounted
  at the path `taxi-pay.db` lives under, or
- swap the datasource for Postgres per the build spec (§2) — a bigger change, since it also means
  switching Drizzle's dialect from `sqlite-core` to `pg-core`.

## Project layout

```
app/
  page.tsx                       landing page
  driver/page.tsx                driver dashboard (client component)
  pay/[id]/page.tsx              rider payment screen (client component)
  api/
    transactions/route.ts               POST — driver requests a fare
    transactions/[id]/route.ts          GET  — poll a transaction's status
    transactions/[id]/pay/route.ts      POST — rider pays
    driver/summary/route.ts             GET  — driver's dashboard data
    driver/cashout/route.ts             POST — simulate a payout
lib/
  schema.ts             Drizzle table definitions
  db.ts                 SQLite connection + table creation + demo seed data
  queries.ts            business logic (fare limits, wallet updates, etc.)
  payment-provider.ts   PaymentProvider interface + MockPaymentProvider
```

## Swapping in a real payment provider

Everything payment-related goes through the `PaymentProvider` interface in `lib/payment-provider.ts`.
To integrate a real provider (a PSP sandbox like Yoco or Peach Payments, or eventually PayShap via a
bank/PSP partner), write a class implementing that interface and swap the `paymentProvider` export —
nothing in the API routes, pages, or database layer needs to change.

## Where this goes next

See `TAXI-CASHLESS-PAYMENT-BUILD-SPEC.md` (shipped alongside this repo) for the full architecture
reasoning, the data model, the two hard problems this prototype doesn't solve on its own (driver
same-day cash flow, patchy connectivity), and the phased plan for turning this into something real.
