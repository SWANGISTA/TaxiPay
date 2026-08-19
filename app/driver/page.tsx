"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Transaction } from "@/lib/schema";

type Summary = {
  balance: number;
  cashedOut: number;
  totalToday: number;
  ridesToday: number;
  recent: Transaction[];
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function DriverPage() {
  const [fare, setFare] = useState("15");
  const [activeTxn, setActiveTxn] = useState<Transaction | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const refreshSummary = useCallback(async () => {
    const res = await fetch("/api/driver/summary");
    if (res.ok) setSummary(await res.json());
  }, []);

  // Poll for the driver's own dashboard data. The initial fetch is kicked
  // off via a timer (rather than called directly in the effect body) so it
  // runs as an external-callback tick, same shape as the interval itself.
  useEffect(() => {
    const kickoff = setTimeout(refreshSummary, 0);
    const t = setInterval(refreshSummary, 3000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(t);
    };
  }, [refreshSummary]);

  // Poll the active transaction so the dashboard reacts the moment the
  // rider pays — in production this would be a websocket / realtime
  // subscription instead of polling.
  useEffect(() => {
    if (!activeTxn || activeTxn.status !== "PENDING") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/transactions/${activeTxn.id}`);
      if (!res.ok) return;
      const data: Transaction = await res.json();
      if (data.status !== "PENDING") {
        setActiveTxn(data);
        refreshSummary();
      }
    }, 1200);
    return () => clearInterval(t);
  }, [activeTxn, refreshSummary]);

  async function generateQr(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(fare) }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create fare request");
      return;
    }
    setActiveTxn({
      id: data.id,
      amount: Number(fare),
      status: "PENDING",
      driverId: "",
      vehicleId: "",
      riderRef: null,
      createdAt: Date.now(),
      paidAt: null,
    });
  }

  async function handleCashOut() {
    await fetch("/api/driver/cashout", { method: "POST" });
    refreshSummary();
  }

  // activeTxn is only ever set client-side (from the form submit handler
  // below), so `window` is always available by the time this is read —
  // no effect/state needed just to read the origin.
  const payUrl =
    activeTxn && typeof window !== "undefined" ? `${window.location.origin}/pay/${activeTxn.id}` : "";

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">ServiceHub → TaxiPay driver dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Prototype only — payments here are simulated by a mock provider, not a real payment rail. See the
          build spec for what a production integration looks like.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Wallet balance" value={`R${(summary?.balance ?? 0).toFixed(2)}`} />
        <Kpi label="Earned today" value={`R${(summary?.totalToday ?? 0).toFixed(2)}`} />
        <Kpi label="Rides today" value={String(summary?.ridesToday ?? 0)} />
        <Kpi label="Cashed out (total)" value={`R${(summary?.cashedOut ?? 0).toFixed(2)}`} />
      </section>

      <div className="grid gap-6 md:grid-cols-[380px_1fr]">
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Request a fare</h2>

          <form onSubmit={generateQr} className="mb-5 flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="fare" className="mb-1 block text-xs font-medium uppercase text-neutral-500">
                Fare amount (R)
              </label>
              <input
                id="fare"
                type="number"
                min={1}
                max={500}
                value={fare}
                onChange={(e) => setFare(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {generating ? "Generating…" : "Generate QR"}
            </button>
          </form>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          {activeTxn && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              {activeTxn.status === "PENDING" && payUrl && (
                <>
                  <QRCodeSVG value={payUrl} size={180} />
                  <p className="text-center text-xs text-neutral-500 break-all">{payUrl}</p>
                  <p className="text-sm font-medium text-amber-700">
                    Waiting for rider to pay R{activeTxn.amount.toFixed(2)}…
                  </p>
                </>
              )}
              {activeTxn.status === "PAID" && (
                <p className="text-center text-sm font-semibold text-green-700">
                  ✓ Paid — R{activeTxn.amount.toFixed(2)} received
                </p>
              )}
              {activeTxn.status === "FAILED" && (
                <p className="text-center text-sm font-semibold text-red-700">
                  ✕ Payment failed — ask the rider to scan again
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCashOut}
            disabled={!summary?.balance}
            className="mt-5 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cash out R{(summary?.balance ?? 0).toFixed(2)} now
          </button>
          <p className="mt-2 text-center text-xs text-neutral-400">
            Simulates same-day payout — the real design problem this idea has to solve. See build spec §5.
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Recent transactions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="pb-2">Time</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary?.recent.length ? (
                summary.recent.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100">
                    <td className="py-2 text-neutral-600">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 text-neutral-900">R{t.amount.toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-400">
                    No transactions yet — generate a QR to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
