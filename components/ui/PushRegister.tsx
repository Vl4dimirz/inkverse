"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: string, cb: (data: unknown) => void): Promise<unknown>;
}

// Runs only inside the Capacitor Android app: asks for push permission, registers
// the FCM token with the server, and routes when a notification is tapped.
export default function PushRegister() {
  const router = useRouter();

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { Plugins?: { PushNotifications?: PushPlugin } } }).Capacitor;
    const PN = cap?.Plugins?.PushNotifications;
    if (!PN) return;

    (async () => {
      try {
        let perm = await PN.checkPermissions();
        if (perm.receive !== "granted" && perm.receive !== "denied") {
          perm = await PN.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        await PN.register();

        await PN.addListener("registration", (data) => {
          const token = (data as { value?: string })?.value;
          if (!token) return;
          fetch("/api/app/push-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, platform: "android" }),
          }).catch(() => {});
        });

        await PN.addListener("pushNotificationActionPerformed", (data) => {
          const link = (data as { notification?: { data?: { link?: string } } })?.notification?.data?.link;
          if (link) router.push(link);
        });
      } catch {
        /* not in app / plugin unavailable */
      }
    })();
  }, [router]);

  return null;
}
