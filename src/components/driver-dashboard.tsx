"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DELIVERY_STATUS_LABELS, DELIVERY_ACTION_LABELS, DRIVER_TRANSITIONS, formatINR } from "@/lib/utils";

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(path, init ? { headers: { "Content-Type": "application/json" }, ...init } : undefined);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

type Delivery = {
  id: string; orderId: string; orderNumber: string; status: string;
  shippingName: string; phone: string; address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  paymentMethod: string; total: number; deliveryNotes: string | null;
  assignedAt: string; updatedAt: string; itemCount: number;
};

type CompletedDelivery = {
  id: string; orderNumber: string; status: string; shippingName: string;
  deliveredAt: string | null; otpVerified: boolean;
};

type DeliveryDetail = Delivery & {
  email: string; pickedUpAt: string | null; deliveredAt: string | null;
  otpVerified: boolean; notes: string | null;
};

type DeliveryItem = { name: string; size: string; color: string; qty: number };
type DeliveryEvent = { id: string; status: string; note: string | null; createdAt: string };

export function DriverDashboard({ driverName }: { driverName: string }) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [completed, setCompleted] = useState<CompletedDelivery[] | null>(null);
  const [detail, setDetail] = useState<{ delivery: DeliveryDetail; items: DeliveryItem[]; events: DeliveryEvent[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const loadActive = useCallback(async () => {
    const { ok, data } = await api<{ deliveries: Delivery[] }>("/api/driver?view=active");
    if (ok) setDeliveries(data.deliveries);
  }, []);

  const loadCompleted = useCallback(async () => {
    const { ok, data } = await api<{ completed: CompletedDelivery[] }>("/api/driver?view=completed");
    if (ok) setCompleted(data.completed);
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);
  useEffect(() => { if (tab === "completed") loadCompleted(); }, [tab, loadCompleted]);

  async function openDetail(id: string) {
    const { ok, data } = await api<{ delivery: DeliveryDetail; items: DeliveryItem[]; events: DeliveryEvent[] }>(`/api/driver?view=detail&id=${id}`);
    if (ok) setDetail(data as { delivery: DeliveryDetail; items: DeliveryItem[]; events: DeliveryEvent[] });
  }

  async function updateStatus(assignmentId: string, status: string, note = "", otp = "") {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const { ok, data } = await api<{ error?: string; otpVerified?: boolean }>("/api/driver", {
      method: "POST",
      body: JSON.stringify({ assignmentId, status, note, otp }),
    });
    setBusy(false);
    if (ok) {
      setMsg(`Updated to: ${DELIVERY_STATUS_LABELS[status] ?? status}${data.otpVerified ? " (OTP verified)" : ""}`);
      setDetail(null);
      loadActive();
    } else {
      setMsg(data.error ?? "Update failed.");
    }
  }

  function openNavigation(addr: { line1: string; line2?: string; city: string; state: string; pincode: string }) {
    const q = encodeURIComponent(`${addr.line1}, ${addr.city}, ${addr.state} ${addr.pincode}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/account?next=/driver");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-28 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Driver</p>
          <h1 className="text-2xl font-black tracking-tight">{driverName}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/account" className="btn btn-acid !py-2 !text-xs">Switch account</Link>
          <button onClick={logout} className="btn btn-ghost !py-2 !text-xs">Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/[0.06] p-1">
        {(["active", "completed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setDetail(null); }}
            className={`rounded-full py-3 text-sm font-bold transition ${tab === t ? "bg-white text-black" : "text-fog hover:text-white"}`}
          >
            {t === "active" ? "Active" : "Completed"}
          </button>
        ))}
      </div>

      {msg && <p className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">{msg}</p>}

      {/* Detail view */}
      {detail && (
        <DeliveryDetailView
          detail={detail}
          busy={busy}
          onUpdateStatus={updateStatus}
          onOpenNav={openNavigation}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Active deliveries list */}
      {!detail && tab === "active" && (
        <div className="mt-6 flex flex-col gap-3">
          {deliveries === null ? (
            <div className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" />
          ) : deliveries.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/[0.06] py-16 text-center text-sm text-fog">
              No active deliveries assigned to you.
            </div>
          ) : (
            deliveries.map((d) => (
              <button
                key={d.id}
                onClick={() => openDetail(d.id)}
                className="surface-card !rounded-[1.5rem] p-5 text-left transition-all hover:border-white/15 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{d.orderNumber}</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fog">{d.shippingName}</p>
                <p className="text-xs text-fog/60">{(d.address as { city: string }).city} · {d.itemCount} items · {formatINR(d.total)}</p>
                {d.paymentMethod === "cod" && <p className="mt-1 text-[11px] font-bold text-white/70">COD — collect {formatINR(d.total)}</p>}
              </button>
            ))
          )}
        </div>
      )}

      {/* Completed deliveries */}
      {!detail && tab === "completed" && (
        <div className="mt-6 flex flex-col gap-3">
          {completed === null ? (
            <div className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" />
          ) : completed.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/[0.06] py-16 text-center text-sm text-fog">
              No completed deliveries yet.
            </div>
          ) : (
            completed.map((d) => (
              <div key={d.id} className="surface-card !rounded-[1.5rem] p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{d.orderNumber}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${d.status === "delivered" ? "bg-white/15 text-white" : "bg-white/5 text-fog"}`}>
                    {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-fog">{d.shippingName} · {d.deliveredAt ? new Date(d.deliveredAt).toLocaleDateString("en-IN") : ""}</p>
                {d.otpVerified && <p className="mt-1 text-[10px] font-bold text-white/60">OTP Verified ✓</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryDetailView({
  detail,
  busy,
  onUpdateStatus,
  onOpenNav,
  onClose,
}: {
  detail: { delivery: DeliveryDetail; items: DeliveryItem[]; events: DeliveryEvent[] };
  busy: boolean;
  onUpdateStatus: (id: string, status: string, note?: string, otp?: string) => void;
  onOpenNav: (addr: { line1: string; line2?: string; city: string; state: string; pincode: string }) => void;
  onClose: () => void;
}) {
  const { delivery: d, items, events } = detail;
  const addr = d.address as { line1: string; line2?: string; city: string; state: string; pincode: string };
  const [note, setNote] = useState("");
  const [otp, setOtp] = useState("");
  const nextStatuses = DRIVER_TRANSITIONS[d.status] ?? [];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <button onClick={onClose} className="self-start text-xs text-fog underline underline-offset-4">← Back to list</button>

      <div className="surface-card !rounded-[1.5rem] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">{d.orderNumber}</h2>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
            {DELIVERY_STATUS_LABELS[d.status]}
          </span>
        </div>

        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Deliver to</p>
          <p className="mt-2 font-semibold">{d.shippingName}</p>
          <p className="mt-1 text-sm text-fog">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
          <p className="text-sm text-fog">{addr.city}, {addr.state} — {addr.pincode}</p>
          <div className="mt-3 flex gap-2">
            <a href={`tel:${d.phone}`} className="btn btn-ghost !py-2 !text-xs flex-1">Call {d.phone}</a>
            <button onClick={() => onOpenNav(addr)} className="btn btn-acid !py-2 !text-xs flex-1">Navigate</button>
          </div>
        </div>

        {d.paymentMethod === "cod" && (
          <div className="mt-4 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Collect on delivery</p>
            <p className="mt-1 text-2xl font-black">{formatINR(d.total)}</p>
          </div>
        )}

        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Items ({items.length})</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-fog">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>{it.name} — {it.size}/{it.color}</span>
                <span>×{it.qty}</span>
              </li>
            ))}
          </ul>
        </div>

        {d.notes && (
          <div className="mt-3 rounded-2xl bg-white/[0.03] px-4 py-3 text-xs text-fog">
            <span className="font-bold">Customer note:</span> {d.notes}
          </div>
        )}
      </div>

      {/* Status update actions */}
      {nextStatuses.length > 0 && (
        <div className="surface-card !rounded-[1.5rem] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Update status</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add delivery note (optional)"
            rows={2}
            className="input mt-3 resize-none"
          />
          {nextStatuses.includes("delivered") && (
            <div className="mt-3">
              <label className="text-xs text-fog">Customer OTP (required)</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP from customer"
                maxLength={6}
                required
                pattern="[0-9]{6}"
                inputMode="numeric"
                className="input mt-1"
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                disabled={busy || (status === "delivered" && !/^\d{6}$/.test(otp))}
                onClick={() => onUpdateStatus(d.id, status, note, status === "delivered" ? otp : "")}
                className={`btn !py-3 !text-[11px] font-black uppercase tracking-widest flex-1 min-w-[140px] ${
                  status === "delivered" ? "btn-acid" : "btn-ghost"
                }`}
              >
                {busy ? "Updating…" : DELIVERY_ACTION_LABELS[status] ?? status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Event timeline */}
      <div className="surface-card !rounded-[1.5rem] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Timeline</p>
        <ol className="mt-3 flex flex-col gap-3">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-white/30" />
              <div>
                <p className="font-semibold">{DELIVERY_STATUS_LABELS[ev.status] ?? ev.status}</p>
                {ev.note && <p className="text-xs text-fog">{ev.note}</p>}
                <p className="text-[10px] text-fog/50">{new Date(ev.createdAt).toLocaleString("en-IN")}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
