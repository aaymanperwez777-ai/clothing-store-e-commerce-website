"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const LiquidGlassLogo = dynamic(
  () => import("./liquid-glass-logo").then((m) => m.LiquidGlassLogo),
  { ssr: false }
);

/**
 * Device-adaptive intro profiling.
 *
 * Key insight: `logoSize` controls the TEXTURE quality of the glass sphere
 * and logo â€” reducing it makes the intro look worse, not smoother.
 *
 * What actually controls smoothness is canvas pixel count = CSS size × DPR.
 * On phones, the CSS size is already small (360px wide), so even at DPR 2.0
 * the canvas is only 720px wide â€” manageable.
 *
 * The real win is capping DPR to match the device's ACTUAL pixel ratio
 * (not oversample), and using a slightly faster speed so the GPU does
 * fewer total frames of work.
 */
function getDeviceProfile() {
  if (typeof window === "undefined")
    return { logoSize: 400, maxDpr: 2, speed: 0.65, frameSize: "min(32rem, 72vw)" };

  const w = window.innerWidth;
  const isMobile = w < 768;
  const isSmallMobile = w < 430;
  const isTablet = w >= 768 && w < 1024;
  const deviceDpr = window.devicePixelRatio || 1;

  // Keep full asset / glass quality everywhere.
  const logoSize = 400;

  // What actually hurts phones is TOTAL PIXEL COUNT.
  // Keep density high enough to look sharp, but never oversample needlessly.
  const maxDpr = isMobile
    ? Math.min(deviceDpr, 1.5)
    : isTablet
      ? Math.min(deviceDpr, 2)
      : 2;

  // Mobile was feeling too fast. Slow it down a little.
  // This keeps the reveal luxurious instead of snappy.
  const speed = isMobile ? 0.58 : 0.65;

  // Dedicated render frame size.
  // IMPORTANT: this reduces the CANVAS area, not the logo texture quality.
  // That means fewer shaded pixels with the same visual sharpness.
  const frameSize = isSmallMobile
    ? "min(78vw, 19rem)"
    : isMobile
      ? "min(82vw, 22rem)"
      : isTablet
        ? "min(70vw, 28rem)"
        : "min(32rem, 72vw)";

  return { logoSize, maxDpr, speed, frameSize };
}

/*
 * The LiquidGlassLogo renderer with ending="logo" finishes its
 * sphere-to-tile animation at `logoFinishTime = 1.8` in *clock* seconds.
 * Real wall-clock time = 1.8 / speed.
 */

export function StoreIntro() {
  const [phase, setPhase] = useState<"check" | "play" | "fade" | "done">("check");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [profile, setProfile] = useState(getDeviceProfile);

  useEffect(() => {
    const isHome = window.location.pathname === "/";

    if (!isHome) {
      setPhase("done");
      document.documentElement.dataset.fcIntro = "skip";
      return;
    }

    try {
      if (sessionStorage.getItem("fc_intro_seen")) {
        setPhase("done");
        document.documentElement.dataset.fcIntro = "skip";
        return;
      }
    } catch {
      setPhase("done");
      document.documentElement.dataset.fcIntro = "skip";
      return;
    }

    const deviceProfile = getDeviceProfile();
    setProfile(deviceProfile);
    setPhase("play");
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.fcIntro = "play";

    const { speed } = deviceProfile;

    const animFinish = Math.ceil(1800 / speed);
    const settleBuffer = 450;
    const holdDuration = 1400;
    const fadeDuration = 900;
    const totalBeforeFade = animFinish + settleBuffer + holdDuration;

    timerRef.current = setTimeout(() => {
      setPhase("fade");
      document.documentElement.dataset.fcIntro = "fade";
      fadeRef.current = setTimeout(() => {
        setPhase("done");
        document.body.style.overflow = "";
        document.documentElement.dataset.fcIntro = "skip";
        try { sessionStorage.setItem("fc_intro_seen", "true"); } catch {}
      }, fadeDuration);
    }, totalBeforeFade);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(fadeRef.current);
      document.body.style.overflow = "";
      document.documentElement.dataset.fcIntro = "skip";
    };
  }, []);

  const skip = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(fadeRef.current);
    setPhase("done");
    document.body.style.overflow = "";
    document.documentElement.dataset.fcIntro = "skip";
    try { sessionStorage.setItem("fc_intro_seen", "true"); } catch {}
  }, []);

  if (phase === "done" || phase === "check") return null;

  const { logoSize, maxDpr, speed, frameSize } = profile;

  return (
    <div
      className="fc-intro"
      style={{ opacity: phase === "fade" ? 0 : 1 }}
      aria-live="polite"
      aria-label="CLOTHING STORE brand reveal"
    >
      <div
        className="fc-intro-frame"
        style={{ width: frameSize, height: frameSize }}
      >
        <LiquidGlassLogo
          logo="/logo.svg"
          ending="logo"
          logoSize={logoSize}
          logoScale={0.78}
          logoColor="original"
          depth={2.3}
          dispersion={0.15}
          relief={0.55}
          caustics={2.0}
          highlights={2.8}
          bloom={1.5}
          dropStrength={1.4}
          decay={2.4}
          echoTint={0.1}
          speed={speed}
          maxDpr={maxDpr}
          aria-label="CLOTHING STORE logo"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <button onClick={skip} className="fc-intro-skip" aria-label="Skip intro">
        Skip
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

