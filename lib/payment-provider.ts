// ---------------------------------------------------------------------------
// PaymentProvider is the seam between this app and money actually moving.
// The prototype uses MockPaymentProvider so the whole flow is demoable with
// zero external accounts. Swap `paymentProvider` below for a real PSP
// (Yoco / Peach Payments / Ozow) or a PayShap integration later — nothing
// else in the codebase needs to change. See the build spec doc, section 6.
// ---------------------------------------------------------------------------

export type PaymentResult = {
  success: boolean;
  reference: string;
  message: string;
};

export interface PaymentProvider {
  charge(params: { amount: number; transactionId: string }): Promise<PaymentResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  async charge({ amount, transactionId }: { amount: number; transactionId: string }): Promise<PaymentResult> {
    // Simulate the round-trip latency of a real payment rail.
    await new Promise((resolve) => setTimeout(resolve, 900));

    // Simulate an occasional decline so the app's failure path is real,
    // not just theoretical — a real PSP will decline sometimes too.
    const success = Math.random() > 0.05;

    return {
      success,
      reference: `MOCK-${transactionId}-${Date.now()}`,
      message: success
        ? `Payment of R${amount.toFixed(2)} approved`
        : "Payment declined by the (simulated) payment provider — try again",
    };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
