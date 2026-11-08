"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatINR, ORDER_STATUS_LABELS } from "@/lib/utils";
import { useCart } from "@/components/cart";

type Msg = { text: string; err: boolean } | null;
type SavedAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  driverId: string | null;
};

export function AccountSwitcher({ currentUserId }: { currentUserId: string | null }) {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/accounts", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load saved accounts.");
        if (!cancelled) setAccounts(data.accounts ?? []);
      })
      .catch(() => {
        if (!cancelled) setMessage("Saved accounts could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  async function accountAction(userId: string, action: "switch" | "remove") {
    if (busyId) return;

    if (action === "remove" && !window.confirm("Remove this saved account from this browser? You may need its password to sign in again.")) {
      return;
    }

    setBusyId(userId);
    setMessage("");

    try {
      const res = await fetch("/api/auth/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Account action failed.");

      if (action === "remove") {
        setAccounts((items) => items.filter((item) => item.id !== userId));
        if (userId === currentUserId) {
          router.push("/account");
        }
        router.refresh();
        return;
      }

      const selected = accounts.find((item) => item.id === userId);
      const destination = selected?.driverId
        ? "/driver"
        : selected?.role === "admin"
          ? "/admin"
          : "/account";

      router.push(destination);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyId("");
    }
  }

  if (loading || (!accounts.length && !message)) return null;

  return (
    <section className="mx-auto mt-6 max-w-5xl px-4 sm:px-6" aria-label="Saved accounts">
      {accounts.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">This browser</p>
              <h2 className="mt-1 text-lg font-black">Switch account</h2>
            </div>
            <span className="text-xs text-fog">{accounts.length} saved</span>
          </div>

          <div className="mt-4 grid gap-2">
            {accounts.map((account) => {
              const isCurrent = account.id === currentUserId;
              const roleLabel = account.driverId ? "Driver" : account.role === "admin" ? "Admin" : "Customer";

              return (
                <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{account.name}</p>
                    <p className="truncate text-xs text-fog">{account.email}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {roleLabel}{isCurrent ? " · Currently active" : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => accountAction(account.id, "switch")}
                        className="btn btn-acid !px-3 !py-2 !text-xs"
                      >
                        {busyId === account.id ? "Please wait…" : "Switch"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => accountAction(account.id, "remove")}
                      className="btn btn-ghost !px-3 !py-2 !text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-fog">
            Saved accounts are available only in this browser. Use this feature only on a trusted device.
            Signing out keeps saved accounts here; Remove revokes that saved session.
          </p>
        </div>
      )}

      {message && <p role="status" className="mt-3 text-xs text-fog">{message}</p>}
    </section>
  );
}

export function AuthForms({ resetToken }: { resetToken: string | null }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const router = useRouter();
  const { refresh } = useCart();

  async function post(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error ?? "Something went wrong.", err: true });
        return false;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (resetToken) {
      const data = await post("reset", { token: resetToken, password: fd.get("password") });
      if (data) {
        setMsg({ text: "Password updated — you can sign in now.", err: false });
        router.replace("/account");
      }
      return;
    }
    if (mode === "forgot") {
      const data = await post("forgot", { email: fd.get("email") });
      if (data) setMsg({ text: data.message, err: false });
      return;
    }
    const payload =
      mode === "register"
        ? { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), password: fd.get("password") }
        : { email: fd.get("email"), password: fd.get("password") };
    const data = await post(mode, payload);
    if (data) {
      await refresh();
      router.refresh();
      if (data.user?.role === "admin") router.push("/admin");
    }
  }

  return (
    <div className="surface-card mt-8 rounded-[2rem] p-8">
      {!resetToken && (
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-line p-1" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setMsg(null); }}
              className={`rounded-full py-2.5 text-sm font-bold transition ${mode === m ? "bg-acid text-acid-ink" : "text-fog hover:text-ivory"}`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {resetToken ? (
          <div>
            <label htmlFor="a-pass" className="mb-1.5 block text-xs font-semibold text-fog">New password (min 8 chars) *</label>
            <input id="a-pass" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
          </div>
        ) : (
          <>
            {mode === "register" && (
              <>
                <div>
                  <label htmlFor="a-name" className="mb-1.5 block text-xs font-semibold text-fog">Full name *</label>
                  <input id="a-name" name="name" required minLength={2} className="input" autoComplete="name" />
                </div>
                <div>
                  <label htmlFor="a-phone" className="mb-1.5 block text-xs font-semibold text-fog">Phone</label>
                  <input id="a-phone" name="phone" type="tel" className="input" placeholder="98765 43210" autoComplete="tel" />
                </div>
              </>
            )}
            <div>
              <label htmlFor="a-email" className="mb-1.5 block text-xs font-semibold text-fog">Email *</label>
              <input id="a-email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="a-pass" className="mb-1.5 block text-xs font-semibold text-fog">
                Password {mode === "register" ? "(min 8 chars) " : ""}*
              </label>
              <input
                id="a-pass"
                name="password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                className="input"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </>
        )}

        <button type="submit" disabled={busy} className="btn btn-acid w-full !py-3.5">
          {busy ? "Please wait…" : resetToken ? "Update password" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
        </button>
      </form>

      {msg && (
        <p role="status" className={`mt-4 rounded-2xl px-4 py-3 text-sm ${msg.err ? "bg-danger/10 text-danger" : "bg-acid/10 text-acid"}`}>
          {msg.text}
        </p>
      )}

      {!resetToken && mode === "login" && (
        <button onClick={() => setMode("forgot")} className="mt-4 w-full text-center text-xs text-fog underline underline-offset-4 hover:text-ivory">
          Forgot your password?
        </button>
      )}
      {mode === "forgot" && (
        <button onClick={() => setMode("login")} className="mt-4 w-full text-center text-xs text-fog underline underline-offset-4 hover:text-ivory">
          Back to sign in
        </button>
      )}
    </div>
  );
}

type OrderLite = { id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; total: number; createdAt: string; items: { id: string; name: string; qty: number; size: string; image: string | null }[] };
type AddressLite = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string };
type WishLite = { id: string; slug: string; name: string; price: number; salePrice: number | null; image: string | null; inStock: boolean };
type NotifLite = { id: string; title: string; body: string; createdAt: string; read: boolean };

export function AccountView({
  user,
  orders,
  addresses,
  wishlist,
  notifications,
}: {
  user: { id: string; name: string; email: string; phone: string | null; role: string };
  orders: OrderLite[];
  addresses: AddressLite[];
  wishlist: WishLite[];
  notifications: NotifLite[];
}) {
  const router = useRouter();
  const { refresh: refreshCart } = useCart();
  const [tab, setTab] = useState<"orders" | "addresses" | "wishlist" | "alerts">("orders");
  const [alertRows, setAlertRows] = useState<NotifLite[]>(notifications);
  const [msg, setMsg] = useState<Msg>(null);
  const unreadCount = alertRows.filter((n) => !n.read).length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function reorder(orderId: string) {
    setMsg(null);
    const res = await fetch("/api/order/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (res.ok) {
      await refreshCart();
      setMsg({ text: `Re-added ${data.added} item(s) to cart${data.skipped ? ` · ${data.skipped} skipped` : ""}.`, err: false });
    } else {
      setMsg({ text: data.error ?? "Could not re-order items.", err: true });
    }
  }

  async function markNotification(ids?: string[]) {
    const action = ids && ids.length ? "mark_read" : "mark_all_read";
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    if (res.ok) {
      setAlertRows((rows) => rows.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Hey {user.name.split(" ")[0]}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your account</h1>
          <p className="mt-1 text-sm text-fog">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && <Link href="/admin" className="btn btn-acid !py-2.5 !text-[13px]">Admin dashboard</Link>}
          <button onClick={logout} className="btn btn-ghost !py-2.5 !text-[13px]">Sign out</button>
        </div>
      </div>

      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {([["orders", `Orders (${orders.length})`], ["addresses", `Addresses (${addresses.length})`], ["wishlist", `Wishlist (${wishlist.length})`], ["alerts", `Alerts (${alertRows.length})${unreadCount ? ` · ${unreadCount} new` : ""}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="chip" data-active={tab === k}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${msg.err ? "bg-danger/10 text-danger" : "bg-white/10 text-white"}`}>
          {msg.text}
        </p>
      )}

      {tab === "orders" && (
        <div className="mt-6 flex flex-col gap-4">
          {orders.length === 0 && (
            <div className="surface-card grid place-items-center gap-3 rounded-[2rem] py-16 text-center">
              <p className="font-bold">No orders yet</p>
              <Link href="/shop" className="btn btn-acid">Start shopping</Link>
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} className="surface-card !rounded-[2rem] p-6 transition hover:border-white/20">
              <Link href={`/order/${o.orderNumber}`} className="block">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-fog">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {o.paymentMethod === "cod" ? "COD" : "Online"} · {o.paymentStatus}</p>
                  </div>
                  <span className="chip" data-active={o.status === "delivered"}>{ORDER_STATUS_LABELS[o.status]}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 4).map((it) => (
                      <span key={it.id} className="relative block size-11 overflow-hidden rounded-full border-2 border-charcoal bg-smoke">
                        {it.image && <Image src={it.image} alt={it.name} fill sizes="44px" className="object-cover" />}
                      </span>
                    ))}
                    <span className="grid size-11 place-items-center rounded-full border-2 border-charcoal bg-smoke text-[11px] font-bold text-fog">
                      {o.items.reduce((s, i) => s + i.qty, 0)}pc
                    </span>
                  </div>
                  <p className="font-bold tabular-nums">{formatINR(o.total)}</p>
                </div>
              </Link>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <Link href={`/order/${o.orderNumber}`} className="btn btn-ghost !px-4 !py-2 !text-[12px]">Details</Link>
                <button onClick={() => reorder(o.id)} className="btn btn-acid !px-4 !py-2 !text-[12px]">Re-order items</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "addresses" && <AddressesPanel addresses={addresses} onChanged={() => router.refresh()} />}

      {tab === "wishlist" && (
        <div className="mt-6">
          {wishlist.length === 0 ? (
            <div className="surface-card grid place-items-center gap-3 rounded-[2rem] py-16 text-center">
              <p className="font-bold">Wishlist is empty</p>
              <p className="text-sm text-fog">Tap the heart on any product to save it here.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {wishlist.map((w) => (
                <li key={w.id} className="surface-card flex items-center gap-4 !rounded-[1.8rem] p-4">
                  <Link href={`/product/${w.slug}`} className="relative block size-20 shrink-0 overflow-hidden rounded-2xl bg-charcoal">
                    {w.image && <Image src={w.image} alt={w.name} fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${w.slug}`} className="block truncate font-semibold">{w.name}</Link>
                    <p className="text-sm text-fog tabular-nums">{formatINR(w.salePrice ?? w.price)}</p>
                    {!w.inStock && <p className="text-xs text-danger">Currently sold out</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: w.id }) });
                      router.refresh();
                    }}
                    aria-label={`Remove ${w.name} from wishlist`}
                    className="grid size-9 place-items-center rounded-full border border-line text-fog hover:text-danger"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="mt-6 flex flex-col gap-3">
          {alertRows.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <button onClick={() => markNotification()} className="btn btn-ghost !py-2 !text-[12px]">Mark all read</button>
            </div>
          )}
          {alertRows.length === 0 && <p className="surface-card rounded-[2rem] py-16 text-center text-sm text-fog">No notifications yet.</p>}
          {alertRows.map((n) => (
            <article key={n.id} className={`surface-card !rounded-[1.6rem] p-5 ${!n.read ? "border-white/20 bg-white/[0.03]" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="mt-1 text-sm text-fog">{n.body}</p>
                  <p className="mt-2 text-[11px] text-fog/70">{new Date(n.createdAt).toLocaleString("en-IN")}</p>
                </div>
                {!n.read && (
                  <button onClick={() => markNotification([n.id])} className="btn btn-ghost !px-3 !py-2 !text-[11px] whitespace-nowrap">
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressesPanel({ addresses, onChanged }: { addresses: AddressLite[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fd.get("fullName"), phone: fd.get("phone"), line1: fd.get("line1"),
        line2: fd.get("line2"), city: fd.get("city"), state: fd.get("state"), pincode: fd.get("pincode"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      onChanged();
    } else setMsg({ text: data.error ?? "Failed.", err: true });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4">
        {addresses.length === 0 && !adding && (
          <p className="surface-card rounded-[2rem] py-14 text-center text-sm text-fog">No saved addresses yet.</p>
        )}
        {addresses.map((a) => (
          <article key={a.id} className="surface-card flex items-start justify-between gap-4 !rounded-[1.6rem] p-6">
            <address className="text-sm not-italic leading-relaxed text-silver">
              <span className="font-bold text-ivory">{a.fullName}</span> · {a.phone}<br />
              {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
            </address>
            <button
              onClick={async () => {
                await fetch("/api/addresses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
                onChanged();
              }}
              className="btn btn-ghost !py-2 !text-[12px]"
            >
              Delete
            </button>
          </article>
        ))}
      </div>

      {adding ? (
        <form onSubmit={submit} className="surface-card mt-4 grid gap-4 rounded-[1.8rem] p-6 sm:grid-cols-2">
          <input name="fullName" required placeholder="Full name" className="input" aria-label="Full name" />
          <input name="phone" required placeholder="Phone" className="input" aria-label="Phone" />
          <input name="line1" required placeholder="Address line 1" className="input sm:col-span-2" aria-label="Address line 1" />
          <input name="line2" placeholder="Address line 2 (optional)" className="input sm:col-span-2" aria-label="Address line 2" />
          <input name="city" required placeholder="City" className="input" aria-label="City" />
          <input name="state" required placeholder="State" className="input" aria-label="State" />
          <input name="pincode" required maxLength={6} placeholder="PIN code" className="input" aria-label="PIN code" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-acid !py-2.5 !text-[13px]">{busy ? "Saving…" : "Save address"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost !py-2.5 !text-[13px]">Cancel</button>
          </div>
          {msg && <p className={`text-sm ${msg.err ? "text-danger" : "text-acid"} sm:col-span-2`}>{msg.text}</p>}
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="btn btn-ghost mt-4 !py-2.5 !text-[13px]">+ Add new address</button>
      )}
    </div>
  );
}
