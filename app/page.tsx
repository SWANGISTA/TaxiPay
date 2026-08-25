import DriverDashboardLink from "./components/DriverDashboardLink";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Prototype</p>
      <h1 className="text-3xl font-bold tracking-tight">TaxiPay</h1>
      <p className="mt-4 text-neutral-600">
        A cashless payment demo for South African minibus taxis — driver generates a fare QR, rider scans and
        pays from their own phone, no app install required. Built to prove the flow, not to move real money;
        see the build spec doc alongside this repo for the production architecture and the two hard problems
        (driver same-day cash flow, patchy connectivity) that actually decide whether this works.
      </p>
      <DriverDashboardLink
        href="/driver"
        className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:brightness-110"
      >
        Open driver dashboard →
      </DriverDashboardLink>
      <p className="mt-3 text-xs text-neutral-400">
        Generate a QR there, then open the link it shows (or scan it with a second device) to pay as the rider.
      </p>
    </main>
  );
}
