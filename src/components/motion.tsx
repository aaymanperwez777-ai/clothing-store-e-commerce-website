"use client";

import React, { useEffect, useRef, useCallback } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/* ─────────────────── CURSOR SPOTLIGHT ─────────────────── */
/**
 * Full-page radial light that follows the cursor.
 * Gives every surface a sense of 3D depth.
 * GPU-only (background-image on a fixed div, no layout).
 */
export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pos = useRef({ x: 0.5, y: 0.5 });
  const cur = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReduced()) return;

    const onMove = (e: PointerEvent) => {
      pos.current.x = e.clientX / window.innerWidth;
      pos.current.y = e.clientY / window.innerHeight;
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };

    const tick = () => {
      raf.current = 0;
      cur.current.x += (pos.current.x - cur.current.x) * 0.08;
      cur.current.y += (pos.current.y - cur.current.y) * 0.08;
      const x = (cur.current.x * 100).toFixed(1);
      const y = (cur.current.y * 100).toFixed(1);
      el.style.background = `radial-gradient(ellipse 800px 600px at ${x}% ${y}%, rgba(255,255,255,0.03) 0%, transparent 70%)`;
      if (
        Math.abs(pos.current.x - cur.current.x) > 0.001 ||
        Math.abs(pos.current.y - cur.current.y) > 0.001
      ) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-1000"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

/* ─────────────────── REVEAL ─────────────────── */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) {
      el.classList.add("revealed");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("revealed");
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─────────────────── 3D TILT with DYNAMIC LIGHT ─────────────────── */
/**
 * Enhanced tilt — rotates the card AND moves a radial highlight
 * to simulate a real light source catching the surface.
 */
export function Tilt({
  children,
  className = "",
  max = 6,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const target = useRef({ rx: 0, ry: 0, lx: 50, ly: 50 });
  const current = useRef({ rx: 0, ry: 0, lx: 50, ly: 50 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReduced()) return;

    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.rx += (t.rx - c.rx) * 0.1;
      c.ry += (t.ry - c.ry) * 0.1;
      c.lx += (t.lx - c.lx) * 0.1;
      c.ly += (t.ly - c.ly) * 0.1;

      el.style.transform = `perspective(800px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg) scale3d(1.02,1.02,1.02)`;

      // Dynamic light overlay — a subtle radial highlight that follows the pointer
      const shine = el.querySelector("[data-tilt-shine]") as HTMLElement | null;
      if (shine) {
        shine.style.background = `radial-gradient(circle at ${c.lx.toFixed(0)}% ${c.ly.toFixed(0)}%, rgba(255,255,255,0.08) 0%, transparent 60%)`;
      }

      const moving =
        Math.abs(t.rx - c.rx) > 0.01 ||
        Math.abs(t.ry - c.ry) > 0.01 ||
        Math.abs(t.lx - c.lx) > 0.1 ||
        Math.abs(t.ly - c.ly) > 0.1;
      if (moving) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
      }
    };

    const start = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      target.current = {
        rx: -(py - 0.5) * max,
        ry: (px - 0.5) * max,
        lx: px * 100,
        ly: py * 100,
      };
      start();
    };

    const onLeave = () => {
      target.current = { rx: 0, ry: 0, lx: 50, ly: 50 };
      start();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [max]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transformStyle: "preserve-3d", willChange: "transform" }}
    >
      {children}
      {/* Light overlay — the tilt tick updates its gradient */}
      <div
        data-tilt-shine
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </div>
  );
}

/* ─────────────────── MAGNETIC ─────────────────── */
export function Magnetic({
  children,
  className = "",
  strength = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReduced()) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < r.width * 1.5) {
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
      }
    };
    const onLeave = () => {
      el.style.transform = "translate3d(0,0,0)";
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);
  return (
    <div
      ref={ref}
      className={`inline-block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/* ─────────────────── PARALLAX ─────────────────── */
export function Parallax({
  children,
  speed = 0.12,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    const update = () => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-center * speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [speed]);
  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────── FLOATING 3D SHAPES ─────────────────── */
/**
 * Decorative floating geometric shapes at different parallax depths.
 * Pure CSS transforms — zero JS after mount.
 */
export function FloatingShapes() {
  if (prefersReduced()) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ring */}
      <div className="absolute -right-20 top-[15%] size-40 animate-float rounded-full border border-white/[0.03] opacity-60" />
      {/* Small dot */}
      <div className="absolute left-[8%] top-[40%] size-2 rounded-full bg-white/[0.08] animate-float-slow" />
      {/* Large soft ring */}
      <div className="absolute -left-32 bottom-[20%] size-64 animate-float-slow rounded-full border border-white/[0.02]" />
      {/* Diamond */}
      <div className="absolute right-[15%] bottom-[30%] size-4 rotate-45 border border-white/[0.06] animate-float opacity-50" />
      {/* Horizontal line */}
      <div className="absolute left-[20%] top-[65%] h-px w-20 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-float-slow" />
    </div>
  );
}

/* ─────────────────── PAGE TRANSITION ─────────────────── */
/**
 * Wraps page content with a fade-in on mount.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) {
      if (el) el.style.opacity = "1";
      return;
    }
    // Force a reflow then transition
    el.getBoundingClientRect();
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(12px)",
        transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {children}
    </div>
  );
}
