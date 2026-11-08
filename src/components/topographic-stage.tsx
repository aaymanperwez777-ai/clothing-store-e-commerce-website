"use client";

import { TopographicFlow } from "@/components/topographic-flow";

export function TopographicStage({ children }: { children?: React.ReactNode }) {
  return (
    <TopographicFlow
      animateEntrance={true}
      scale={280}
      density={7}
      speed={3}
      distortion={3}
      lineWidth={1}
      opacity={0.85}
      dashLength={9}
      dashGap={6}
      seed={355}
      gradientDiffusion={0}
      paused={false}
      hover={0.6}
      hoverRadius={200}
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
      className="h-full"
      style={{ height: "100%" }}
    >
      {children}
    </TopographicFlow>
  );
}
