export const RENT_PAYMENT_STATUSES = ["due", "paid", "late", "cancelled"] as const;

export type RentPaymentStatus = (typeof RENT_PAYMENT_STATUSES)[number];

export const RENT_PAYMENT_STATUS_LABELS: Record<RentPaymentStatus, string> = {
  due: "Due",
  paid: "Paid",
  late: "Late",
  cancelled: "Cancelled",
};

export type RentPaymentDoc = {
  agencyId: string;
  tenancyId: string;
  propertyId: string;
  propertyDisplayLabel: string | null;
  tenantName: string;
  rentAmount: number;
  /** ISO yyyy-mm-dd */
  dueDate: string;
  status: RentPaymentStatus;
  paidAt: unknown | null;
  amountPaid: number | null;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
};

export type RentPaymentListItem = {
  id: string;
  tenancyId: string;
  propertyId: string;
  propertyDisplayLabel: string | null;
  tenantName: string;
  rentAmount: number;
  dueDate: string;
  status: RentPaymentStatus;
  paidAt: number | null;
  amountPaid: number | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export function isRentPaymentStatus(s: unknown): s is RentPaymentStatus {
  return typeof s === "string" && (RENT_PAYMENT_STATUSES as readonly string[]).includes(s);
}

