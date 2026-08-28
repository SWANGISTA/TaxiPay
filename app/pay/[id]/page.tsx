"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Transaction } from "@/lib/schema";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [txn, setTxn] = useState<Transaction | null | "not-found">(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions/${id}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setTxn("not-found");
        return;
      }
      setTxn(await res.json());
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function pay() {
    setPaying(true);
    setError("");
    const res = await fetch(`/api/transactions/${id}/pay`, { method: "POST" });
    const data = await res.json();
    setPaying(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setTxn((t) => (t && t !== "not-found" ? { ...t, status: data.status } : t));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
      {txn === null && <p className="text-neutral-500">Loading fare…</p>}

      {txn === "not-found" && (
        <div>
          <p className="text-lg font-semibold text-red-600">Fare not found</p>
          <p className="mt-2 text-sm text-neutral-500">
            This QR code may have expired, or the link is wrong. Ask the driver to generate a new one.
          </p>
        </div>
      )}

      {txn && txn !== "not-found" && (
        <div className="w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-brand">TaxiPay</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">R{txn.amount.toFixed(2)}</p>
          <p className="mt-1 text-sm text-neutral-500">Fare requested by your driver</p>

          {txn.status === "PENDING" && (
            <>
              <button
                onClick={pay}
                disabled={paying}
                className="mt-6 w-full rounded-lg bg-brand py-3 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {paying ? "Processing…" : "Pay now"}
              </button>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <p className="mt-4 text-xs text-neutral-400">
                Simulated payment — no real money moves in this prototype.
              </p>
            </>
          )}

          {txn.status === "PAID" && (
            <p className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              ✓ Payment successful — the driver has been notified.
            </p>
          )}

          {txn.status === "FAILED" && (
            <>
              <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                ✕ Payment failed. Ask the driver to show the QR code again.
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
