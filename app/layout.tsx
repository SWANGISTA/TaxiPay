import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaxiPay — cashless minibus taxi payment prototype",
  description: "Prototype: tap-to-pay for South African minibus taxis",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
