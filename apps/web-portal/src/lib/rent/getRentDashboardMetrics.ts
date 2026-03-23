/**
 * Compute rent dashboard KPIs from a list of rent payment items (e.g. from GET /api/admin/rent).
 * All logic is read-time only; no Firestore or background jobs.
 */

export type RentPaymentForMetrics = {
  status: string;
  tenancyId?: string | null;
  dueDate?: string | null;
  rentAmount?: number;
  amountPaid?: number | null;
  paidAt?: number | null;
};

export type RentDashboardMetrics = {
  latePayments: number;
  tenantsInArrears: number;
  rentDueThisMonth: number;
  rentCollectedThisMonth: number;
};

function safeNum(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return v;
}

function paidAtInMonth(paidAt: number | null | undefined, currentYYYYMM: string): boolean {
  if (paidAt == null || !Number.isFinite(paidAt)) return false;
  const d = new Date(paidAt);
  if (!Number.isFinite(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}` === currentYYYYMM;
}

function dueDateInMonth(dueDate: string | null | undefined, currentYYYYMM: string): boolean {
  if (typeof dueDate !== "string" || !dueDate) return false;
  const prefix = dueDate.slice(0, 7);
  return prefix.length === 7 && prefix === currentYYYYMM;
}

/**
 * Compute KPIs from rent payment list. Uses current calendar month (server local time).
 */
export function getRentDashboardMetrics(payments: RentPaymentForMetrics[]): RentDashboardMetrics {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const currentYYYYMM = `${y}-${m}`;

  let latePayments = 0;
  const lateTenancyIds = new Set<string>();
  let rentDueThisMonth = 0;
  let rentCollectedThisMonth = 0;

  for (const p of payments) {
    const status = typeof p.status === "string" ? p.status : "";

    if (status === "late") {
      latePayments += 1;
      const tid = p.tenancyId != null && String(p.tenancyId).trim() !== "" ? String(p.tenancyId).trim() : null;
      if (tid) lateTenancyIds.add(tid);
    }

    if (status !== "cancelled" && dueDateInMonth(p.dueDate, currentYYYYMM)) {
      rentDueThisMonth += safeNum(p.rentAmount);
    }

    if (status === "paid" && paidAtInMonth(p.paidAt, currentYYYYMM)) {
      const amountPaid = p.amountPaid != null && typeof p.amountPaid === "number" && Number.isFinite(p.amountPaid) && p.amountPaid >= 0
        ? p.amountPaid
        : safeNum(p.rentAmount);
      rentCollectedThisMonth += amountPaid;
    }
  }

  return {
    latePayments,
    tenantsInArrears: lateTenancyIds.size,
    rentDueThisMonth,
    rentCollectedThisMonth,
  };
}
