"use client";

import { useState } from "react";
import { SA_BANKS } from "@/lib/constants";

export type BankAccountSummary = {
  bankName: string;
  accountHolder: string;
  accountType: "SAVINGS" | "CHEQUE";
  last4: string;
  updatedAt: number;
} | null;

// Payouts are still entirely simulated — this just records which account
// "Cash out" would have paid, it never moves real money. See build spec §6
// for why a real bank-transfer rail (e.g. via PayShap) isn't something an
// indie prototype can plug into directly.
export default function BankAccountCard({
  bankAccount,
  onSaved,
}: {
  bankAccount: BankAccountSummary;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bankName, setBankName] = useState(SA_BANKS[0] as string);
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountType, setAccountType] = useState<"SAVINGS" | "CHEQUE">("SAVINGS");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/driver/bank-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName, accountHolder, accountNumber, branchCode, accountType }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save bank account");
      return;
    }
    setAccountNumber("");
    setEditing(false);
    onSaved();
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold">Payout bank account</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Simulated — no real transfer happens, this just decides where &ldquo;Cash out&rdquo; says the money
        went. See build spec §6.
      </p>

      {!editing && bankAccount && (
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {bankAccount.bankName} •••• {bankAccount.last4}
            </p>
            <p className="text-xs text-neutral-500">
              {bankAccount.accountHolder} — {bankAccount.accountType === "SAVINGS" ? "Savings" : "Cheque"}{" "}
              account
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
          >
            Change
          </button>
        </div>
      )}

      {!editing && !bankAccount && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-center">
          <p className="mb-3 text-sm text-neutral-500">No bank account on file yet.</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Add bank account
          </button>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div>
            <label htmlFor="bankName" className="mb-1 block text-xs font-medium uppercase text-neutral-500">
              Bank
            </label>
            <select
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {SA_BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="accountHolder"
              className="mb-1 block text-xs font-medium uppercase text-neutral-500"
            >
              Account holder name
            </label>
            <input
              id="accountHolder"
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="As it appears on the account"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="accountNumber"
                className="mb-1 block text-xs font-medium uppercase text-neutral-500"
              >
                Account number
              </label>
              <input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="branchCode"
                className="mb-1 block text-xs font-medium uppercase text-neutral-500"
              >
                Branch code
              </label>
              <input
                id="branchCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="accountType"
              className="mb-1 block text-xs font-medium uppercase text-neutral-500"
            >
              Account type
            </label>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "SAVINGS" | "CHEQUE")}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="SAVINGS">Savings</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save bank account"}
            </button>
            {bankAccount && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
