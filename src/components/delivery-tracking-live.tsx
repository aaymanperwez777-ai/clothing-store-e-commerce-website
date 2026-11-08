"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DeliveryTrackingLive({
  status,
  isFinished,
}: {
  status: string;
  isFinished: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isFinished) return;

    // Simple polling for "real-time" updates
    // In production, use Supabase Realtime or Socket.io for actual push
    const interval = setInterval(() => {
      router.refresh();
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [isFinished, router]);

  return null;
}
