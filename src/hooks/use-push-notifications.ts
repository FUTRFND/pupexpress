import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

import { registerDeviceToken } from "@/lib/push.functions";

/**
 * Registers the device for push notifications on native (iOS / Android) builds.
 *
 * No-op in the browser / Lovable preview — web push is handled separately and
 * the Capacitor PushNotifications plugin only exists inside the native shell.
 * The plugin is imported dynamically so the web bundle never pulls in native
 * code paths.
 */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    (async () => {
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        const status = await PushNotifications.checkPermissions();
        let receive = status.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          receive = (await PushNotifications.requestPermissions()).receive;
        }
        if (receive !== "granted" || cancelled) return;

        await PushNotifications.addListener("registration", (token) => {
          const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
          registerDeviceToken({
            data: { token: token.value, platform },
          }).catch((err) => console.error("Token register failed:", err));
        });

        await PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        await PushNotifications.register();
      } catch (err) {
        console.error("Push notification setup failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
