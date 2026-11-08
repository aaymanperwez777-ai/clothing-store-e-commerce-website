"use client";

import React, { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  
  const [isVisible, setIsVisible] = useState(false);
  
  // Track mouse coordinates
  const mouse = useRef({ x: 0, y: 0 });
  // Track delayed coordinates for the outer ring
  const trailing = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Only enable on non-touch fine-pointer devices
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    
    setTimeout(() => setIsVisible(true), 0);

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      
      // Instantly move the inner dot
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
      }

      // Check if hovering over clickable elements
      const target = e.target as HTMLElement;
      const isClickable = target.closest("a, button, input, select, textarea, [role='button'], [role='tab']");
      
      if (cursorRef.current) {
        if (isClickable) {
          cursorRef.current.classList.add("cursor-hover");
        } else {
          cursorRef.current.classList.remove("cursor-hover");
        }
      }
    };

    const animate = () => {
      // Smooth interpolation for the outer ring
      trailing.current.x += (mouse.current.x - trailing.current.x) * 0.15;
      trailing.current.y += (mouse.current.y - trailing.current.y) * 0.15;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(calc(${trailing.current.x}px - 50%), calc(${trailing.current.y}px - 50%), 0)`;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    requestRef.current = requestAnimationFrame(animate);

    // Hide default cursor globally when this mounts successfully
    document.body.style.cursor = "none";
    const style = document.createElement("style");
    style.innerHTML = `* { cursor: none !important; }`;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(requestRef.current);
      document.body.style.cursor = "";
      document.head.removeChild(style);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer trailing ring */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] flex size-10 items-center justify-center rounded-full border border-white/40 mix-blend-difference transition-[width,height,border-color,background-color] duration-300 ease-out will-change-transform [&.cursor-hover]:size-16 [&.cursor-hover]:bg-white/10 [&.cursor-hover]:backdrop-blur-sm"
      />
      {/* Inner instant dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[10000] size-1.5 rounded-full bg-white mix-blend-difference will-change-transform"
      />
    </>
  );
}
