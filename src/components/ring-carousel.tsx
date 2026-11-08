"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatINR } from "@/lib/utils";

export type RingProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  img: string;
  category: string;
};

const EASE = "cubic-bezier(.16,1,.3,1)";
const EASE_SPRING = "cubic-bezier(.34,1.56,.64,1)";

export function RingCarousel({ items }: { items: RingProduct[] }) {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dims, setDims] = useState({ w: 900, h: 500 });

  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const elapsedRef = useRef(0);
  const startXRef = useRef(0);
  const dragging = useRef(false);

  const SPEED = 4000;
  const N = items.length;

  const measure = useCallback(() => {
    if (!stageRef.current) return;
    const mobile = window.innerWidth < 768;
    setDims({
      w: stageRef.current.offsetWidth,
      h: mobile ? 380 : 480,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // autoplay
  useEffect(() => {
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      if (!paused) {
        elapsedRef.current += dt;
        if (elapsedRef.current >= SPEED) {
          elapsedRef.current = 0;
          setCur(c => (c + 1) % N);
        }
        setProgress((elapsedRef.current / SPEED) * 100);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, N]);

  const navigate = useCallback((dir: number) => {
    setCur(c => (c + dir + N) % N);
    elapsedRef.current = 0;
    setProgress(0);
  }, [N]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startXRef.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 42) navigate(dx < 0 ? 1 : -1);
  };

  // card dimensions
  const cardW = dims.h * 0.58;
  const cardH = dims.h * 0.82;
  const rx = dims.w * 0.30;
  const rz = 200;
  const cx = dims.w * 0.5;

  const active = items[cur];
  const off = active?.salePrice != null && active.salePrice < active.price
    ? Math.round((1 - active.salePrice / active.price) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Featured</p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Shop the <span className="font-editorial italic font-normal lowercase text-white/60">Ring.</span>
          </h2>
        </div>
        <span className="tabular-nums text-[11px] font-black text-white/30">
          {String(cur + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </span>
      </div>

      {/* stage */}
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-[2rem] border border-white/[0.06] cursor-grab active:cursor-grabbing"
        style={{ height: dims.h, background: "#080808" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={e => {
          if (e.key === "ArrowLeft") navigate(-1);
          if (e.key === "ArrowRight") navigate(1);
        }}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Product ring — use arrow keys or swipe"
      >
        {items.map((item, i) => {
          const slotDelta = ((i - cur) + N) % N;
          const slot = slotDelta <= N / 2 ? slotDelta : slotDelta - N;

          const angle = (slot / N) * Math.PI * 2;
          const x = Math.sin(angle) * rx;
          const z = Math.cos(angle) * rz;
          const scale = 0.52 + 0.48 * ((z + rz) / (rz * 2));
          const opacity = slot === 0 ? 1 : Math.max(0, 0.22 + 0.44 * ((z + rz) / (rz * 2)));
          const blur = slot === 0 ? 0 : Math.abs(slot) * 1.6;
          
          // Revert to full height model proportions
          const modelW = dims.h * 0.5625;
          const posX = cx + x - (modelW * scale) / 2;
          const zIdx = Math.round((z + rz) * 10);
          const isActive = slot === 0;

          const itemOff = item.salePrice != null && item.salePrice < item.price
            ? Math.round((1 - item.salePrice / item.price) * 100)
            : 0;

          return (
            <Link
              key={item.id + "-" + i}
              href={`/product/${item.slug}`}
              aria-label={`${item.name} — ${formatINR(item.salePrice ?? item.price)}`}
              className="block"
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                width: modelW,
                height: dims.h,
                transform: `translateX(${posX}px) scale(${scale.toFixed(3)})`,
                transformOrigin: "50% 100%",
                opacity: +opacity.toFixed(3),
                zIndex: zIdx,
                filter: blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none",
                willChange: "transform,opacity,filter",
                transition: `transform .72s ${EASE}, opacity .72s ${EASE}, filter .72s ${EASE}`,
              }}
              onClick={e => {
                if (i !== cur) {
                  e.preventDefault();
                  navigate(i - cur > N / 2 ? i - cur - N : i - cur < -N / 2 ? i - cur + N : i - cur);
                }
              }}
            >
              {/* contact shadow */}
              <span
                aria-hidden
                style={{
                  position:    "absolute",
                  left:        "50%",
                  bottom:      0,
                  width:       "150%",
                  height:      "9%",
                  minHeight:   14,
                  maxHeight:   46,
                  transform:   "translate(-50%,50%)",
                  filter:      "blur(2px)",
                  background:  "radial-gradient(closest-side,rgb(20 16 12/.28),rgb(20 16 12/.12) 45%,transparent 75%)",
                  pointerEvents:"none",
                }}
              />
              
              {/* Full body image without background/borders */}
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <Image
                  src={item.img}
                  alt={item.name}
                  fill
                  sizes="320px"
                  className="object-contain object-bottom select-none pointer-events-none"
                  draggable={false}
                  priority={i === 0}
                  unoptimized={item.img.startsWith("http") || item.img.startsWith("/uploads/")}
                />
                
                {/* Floating info tag (only visible when active) */}
                <div style={{
                  position: "absolute",
                  bottom: 24,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  padding: "10px 16px",
                  borderRadius: 24,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  opacity: isActive ? 1 : 0,
                  transition: `opacity .4s ${EASE}`,
                  minWidth: "max-content",
                  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.8)",
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                    {item.name}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {formatINR(item.salePrice ?? item.price)}
                    </p>
                    {itemOff > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: "#fff", color: "#000", padding: "2px 6px", borderRadius: 10 }}>
                        -{itemOff}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {/* subtle radial vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 99999,
          background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }} />
      </div>

      {/* controls */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[[-1, "M11 14 6 9l5-5"], [1, "M7 4l5 5-5 5"]].map(([dir, path]) => (
              <button
                key={dir as number}
                className="grid size-10 place-items-center rounded-full border border-white/[0.08] bg-black/40 text-white/60 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
                onClick={() => navigate(dir as number)}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d={path as string} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCur(i); elapsedRef.current = 0; }}
                style={{
                  width: i === cur ? 22 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === cur ? "#fff" : "rgba(255,255,255,0.15)",
                  transition: `width .4s ${EASE_SPRING}, background .3s`,
                  border: "none", cursor: "pointer", padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden h-px w-20 bg-white/10 sm:block">
            <div className="absolute left-0 top-0 h-full bg-white/50" style={{ width: `${progress}%` }} />
          </div>
          <button
            className="grid size-9 place-items-center rounded-full border border-white/[0.08] text-white/50 transition hover:text-white"
            onClick={() => setPaused(p => !p)}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              {paused
                ? <polygon points="2,1 11,6 2,11" />
                : <><rect x="1" y="1" width="3.5" height="10" rx=".5" /><rect x="7.5" y="1" width="3.5" height="10" rx=".5" /></>}
            </svg>
          </button>
          {active && (
            <Link
              href={`/product/${active.slug}`}
              className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white sm:flex"
            >
              View product
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
