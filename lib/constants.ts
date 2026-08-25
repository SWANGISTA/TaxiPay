export const DEMO_DRIVER_ID = "driver-demo";
export const DEMO_VEHICLE_ID = "vehicle-demo";

// Shared between the bank-account form (frontend) and its server-side
// validation (lib/queries.ts) so the two can never drift out of sync.
export const SA_BANKS = [
  "Capitec",
  "FNB",
  "Standard Bank",
  "Absa",
  "Nedbank",
  "TymeBank",
  "Discovery Bank",
  "African Bank",
  "Other",
] as const;
