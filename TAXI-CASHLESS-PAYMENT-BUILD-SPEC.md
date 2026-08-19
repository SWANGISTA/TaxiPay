# Cashless Minibus Taxi Payment — Build Stack Spec

*A code-first (VS Code, not Power Platform) architecture for a tap-to-pay system for South African minibus taxis. Written to be buildable solo, with a real starter scaffold included alongside this doc.*

## 1. The problem this has to solve

Minibus taxis carry the majority of South African commuters and turn over an estimated R90–100 billion a year, almost entirely in cash. The Department of Transport has only reached the request-for-information stage — nothing is built. Earlier cashless attempts reportedly failed for one specific reason: they digitised the passenger's payment but gave drivers no way to turn that money into same-day cash for fuel and rank fees. Any stack chosen here has to take that seriously — this is as much a cash-flow problem as a payments problem.

Two other constraints shape every decision below: connectivity in and around taxi ranks is inconsistent, and the system has to work on whatever phone a commuter already has, not a phone they'd need to buy.

## 2. Stack choice, and why

| Layer | Choice | Why |
|---|---|---|
| Rider + driver interface | **Next.js (React) as a PWA**, TypeScript | No app-store install for riders — a QR code just opens a web page. One codebase serves both the rider "pay" screen and the driver dashboard. Works on low-end Android phones without eating storage. |
| Styling | **Tailwind CSS** | Fast to build a clean, legible UI solo; already scaffolded with the Next.js starter. |
| Backend | **Next.js API routes** (or a separate Node/Express service later if it outgrows this) | Keeps one deployable unit for the prototype stage — no separate backend to stand up, host, or version alongside the frontend. Split it out once real transaction volume or a mobile-native app justifies a dedicated API. |
| Database | **PostgreSQL in production, SQLite for local dev** via **Prisma ORM** | Prisma gives you type-safe queries and migrations from one schema file, and swapping the datasource from SQLite to Postgres later is a one-line config change, not a rewrite. Money needs a relational database with real transactions — this is not a NoSQL problem. |
| Hosting (prototype stage) | **Vercel** (frontend + API routes) + **Supabase** (managed Postgres, once you're past SQLite) | Both have generous free tiers, zero server management, and Supabase adds auth and realtime for free if you need them later — good fit for a solo build with no ops budget. |
| QR generation | **`qrcode.react`** | Renders a QR code client-side from a plain URL — no external QR service dependency. |
| QR payload | A URL: `https://<app>/pay/<transactionId>` | This is the single most important interoperability decision: the QR just opens a normal web page. Any phone's stock camera app can scan it — no dedicated rider app required, which matters enormously for adoption. (A proper EMVCo-standard merchant QR is worth adopting later if this ever needs to interoperate with bank apps directly — flagged in §6.) |
| Payments | An internal `PaymentProvider` interface, backed by a **mock provider** for the prototype and swappable for a real one | You cannot get production PayShap or card-acquiring access as a portfolio project — but you can, and should, write the payment logic against an interface so a real provider (see §6) drops in later without touching the rest of the app. |
| Notifications | **SMS** (via a gateway like Africa's Talking or Clickatell) as the primary confirmation channel, push/in-app as a bonus | Mirrors how M-Pesa and similar systems work in markets where connectivity and smartphone quality are inconsistent — an SMS receipt is trustworthy even if the app itself is having a bad data day. |
| Auth | **Phone number + OTP**, not email/password | Matches how people already identify themselves in this context, and doesn't require anyone to remember a password. |
| Testing | **Playwright** for end-to-end smoke tests of the pay flow | Cheap to set up, and this is exactly the kind of "does the money flow actually work" flow worth automating early. |
| Source control | **GitHub** | Standard, and sets you up to open this in VS Code with the GitHub integration already wired in. |

## 3. Data model (as implemented in `prisma/schema.prisma`)

- **User** — phone number, name, role (`RIDER` / `DRIVER` / `OWNER`)
- **Vehicle** — registration, route/rank association, linked driver
- **Transaction** — payer, payee (driver), vehicle, amount, status (`PENDING` / `PAID` / `FAILED`), QR reference, timestamps
- **Wallet** — running balance per driver/owner, updated on each paid transaction
- **Payout** *(modeled, not built in the prototype)* — a settlement record when a driver cashes out to a bank account or fuel voucher

This is deliberately small. Resist the urge to model routes, fare tables, or operator hierarchies until the core pay flow is proven — those are real phase 2 features, not blockers to a working demo.

## 4. Core flow (what the scaffold actually does)

1. Driver opens `/driver`, enters a fare amount, and taps "Generate QR." This creates a `PENDING` transaction and shows a QR code encoding `/pay/<transactionId>`.
2. Rider scans the QR with their phone's camera (no app needed) and lands on `/pay/<transactionId>`, which shows the fare and a "Pay now" button.
3. Tapping "Pay now" calls the mock `PaymentProvider`, which simulates a short processing delay and marks the transaction `PAID`.
4. The driver's dashboard reflects the payment (polling in the prototype; swap for Supabase Realtime or WebSockets once this is live) and the running daily total updates.

This is the whole trust loop the real system has to earn: driver requests money, rider pays, driver sees it land, in seconds, without cash changing hands.

## 5. The two hard problems this stack doesn't solve on its own

**Driver same-day cash flow.** This is the reason earlier attempts failed, and no amount of good frontend code fixes it — it needs a business/product answer, not just an engineering one. Options worth designing toward: instant (not next-day) payout to a driver wallet the moment a ride is paid for, and/or a direct partnership letting drivers pay for fuel straight from that wallet at partner fuel stations, so cash-out friction disappears rather than just moving. Model this as a first-class feature early, even if the prototype only fakes it with a "Cash out" button.

**Patchy connectivity.** A PWA with a service worker can queue an offline "payment initiated" state and sync once back online, but the cleanest mitigation is architectural: because the QR encodes a URL rather than requiring the driver's device to process the payment, it's the *rider's* connectivity that matters most for a single transaction, not the driver's — riders are more likely to have data than a taxi idling in a low-signal rank. Still worth a USSD fallback (via a gateway like Africa's Talking) for feature-phone riders in a later phase — that's a telecom integration, not a web app, so it's scoped out of this repo but worth knowing it's the same architectural family as M-Pesa's USSD menu.

## 6. Payment integration — what "real" looks like later

The prototype's `PaymentProvider` interface is written so any of these can be swapped in without touching the rest of the app:

- **PayShap** — South Africa's real-time low-value payment rail (via BankservAfrica). The most natural long-term fit given it's built for exactly this kind of instant, low-value, proxy-based (cellphone number) payment — but third-party access typically requires partnering with a participating bank or an authorised PSP, not a direct public API for an indie project.
- **A payment service provider** (Yoco, Peach Payments, Ozow) — faster to get sandbox access to as an individual, useful for proving the flow end-to-end with real (if higher-fee) rails before a bank partnership is realistic.
- **EMVCo-standard QR payload** — if this ever needs to be scannable directly by banking apps rather than only a browser camera, the QR content would need to follow the EMVCo merchant-presented QR spec rather than a plain URL. Worth knowing about, not worth building for a portfolio prototype.

## 7. Security & compliance notes

- **POPIA** (South Africa's data protection law) governs the rider/driver PII this system collects — phone numbers, names, transaction history. Design for data minimisation from day one: don't collect what you don't need yet.
- **Never store card data directly** — that's what PCI-DSS scope is for, and any real PSP integration tokenises this for you. The prototype never touches card details at all.
- Encrypt in transit (TLS, which Vercel/Supabase give you by default) and at rest (Supabase Postgres does this by default).
- Rate-limit the payment confirmation endpoint — an unrestricted "mark this transaction paid" call is an obvious abuse vector once this is more than a demo.

## 8. Phased build plan

**Phase 1 — prototype (this scaffold):** driver generates a QR for a fare, rider pays via a mock provider, driver sees it land, running daily total. Enough to demo the actual trust loop.

**Phase 2:** real PSP sandbox integration (Yoco or Peach Payments) replacing the mock provider; SMS confirmation; basic driver wallet with a manual "request payout" step; simple owner/operator view across more than one vehicle.

**Phase 3:** instant payout / fuel-partner integration to solve the driver cash-flow problem properly; USSD channel for feature-phone riders; route/fare-table presets instead of manual fare entry; fraud/rate-limit hardening.

## 9. Open questions worth answering before this goes past prototype

- Which PSP would actually grant sandbox access to an individual/portfolio project versus requiring a registered business?
- Is there an existing South African interoperable QR standard (BankservAfrica has explored this) worth aligning with now rather than retrofitting later?
- What would a fuel-station partnership realistically require — is same-day payout alone enough, or does the driver cash-flow problem need the fuel voucher piece specifically?
