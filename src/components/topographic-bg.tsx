"use client";

import { useEffect, useState } from "react";
import { TopographicFlow } from "./topographic-flow";

export function TopographicBackground() {
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    // Watch for the intro to finish before starting the heavy background
    const check = () => {
      const state = document.documentElement.dataset.fcIntro;
      if (state === "skip") {
        setPaused(false);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-fc-intro"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <TopographicFlow
        animateEntrance={true}
        scale={280}
        density={7}
        speed={3}
        distortion={3}
        lineWidth={1}
        opacity={0.65} // slightly lower opacity for full-page look
        dashLength={9}
        dashGap={6}
        seed={355}
        gradientDiffusion={0}
        paused={paused}
        hover={0.5}
        hoverRadius={300}
        hoverFollow={0.16}
        hoverFade={0.8}
        hoverEffect={"rings"}
        backgroundColor={"#000000"}
        backgroundImage={"none"}
        gradientColors={[]}
        grain={0}
        lineColor={"#ffffff"}
        accentColor={"#ffffff"}
        lineStyle={"mixed"}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
