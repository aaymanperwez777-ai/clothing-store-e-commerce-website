import { clsx, type ClassValue } from "./clsx";

export { clsx };
export type { ClassValue };

/** Format paise → ₹ string */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function orderNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FC-${t}-${r}`;
}

export function effectivePrice(p: { price: number; salePrice: number | null }): number {
  return p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price;
}

export const ORDER_STEPS = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Driver Assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  unassigned: "Awaiting driver",
  assigned: "Driver assigned",
  accepted: "Driver accepted",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  attempted: "Delivery attempted",
  customer_unavailable: "Customer unavailable",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  returned_to_store: "Returned to store",
};

export const DELIVERY_ACTION_LABELS: Record<string, string> = {
  accepted: "Accept Delivery",
  picked_up: "Mark as Picked Up",
  out_for_delivery: "Mark as Out for Delivery",
  delivered: "Confirm Delivery",
  attempted: "Report Failed Attempt",
  customer_unavailable: "Customer Unavailable",
  rescheduled: "Reschedule",
  returned_to_store: "Return to Store",
};

/** Valid transitions a driver can make */
export const DRIVER_TRANSITIONS: Record<string, string[]> = {
  assigned: ["accepted"],
  accepted: ["picked_up"],
  picked_up: ["out_for_delivery"],
  out_for_delivery: ["delivered", "attempted", "customer_unavailable"],
  attempted: ["out_for_delivery", "returned_to_store", "rescheduled"],
  customer_unavailable: ["out_for_delivery", "returned_to_store", "rescheduled"],
  rescheduled: ["picked_up", "cancelled"],
};

/** Simple per-key sliding-window rate limiter (in-memory, per instance). */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

export function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function isValidPincode(p: string): boolean {
  return /^[1-9][0-9]{5}$/.test(p);
}

export function isValidPhone(p: string): boolean {
  return /^[6-9]\d{9}$/.test(p.replace(/\D/g, "").slice(-10));
}
