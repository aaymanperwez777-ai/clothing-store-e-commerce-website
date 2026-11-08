"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [state, setState] = useState<{ loading: boolean; msg: string; err: boolean }>({ loading: false, msg: "", err: false });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = new FormData(form).get("email") as string;
    setState({ loading: true, msg: "", err: false });
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setState({ loading: false, msg: data.message, err: false });
      form.reset();
    } else {
      setState({ loading: false, msg: data.error ?? "Something went wrong.", err: true });
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="glass flex items-center gap-2 rounded-full p-2 pl-6">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <input
          id="nl-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="min-w-0 flex-1 bg-transparent text-sm text-ivory outline-none placeholder:text-fog"
        />
        <button type="submit" disabled={state.loading} className="btn btn-acid !py-2.5">
          {state.loading ? "Joining…" : "Join"}
        </button>
      </form>
      {state.msg && (
        <p role="status" className={`mt-3 text-sm ${state.err ? "text-danger" : "text-acid"}`}>
          {state.msg}
        </p>
      )}
    </div>
  );
}
