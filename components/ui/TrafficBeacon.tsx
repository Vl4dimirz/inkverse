"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Fires a page-view ping on each route change (server skips admin + bots get no JS).
 *  Respects the cookie choice: if the visitor picked "essential only", we don't track. */
export default function TrafficBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      if (localStorage.getItem("ivCookieConsent") === "essential") return;
    } catch {}
    fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
