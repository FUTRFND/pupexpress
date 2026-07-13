import { useEffect } from "react";

import { enableNativePush } from "@/lib/native-push";

/**
 * Registers the device for push notifications on native (iOS / Android) builds.
 *
 * No-op in the browser / Lovable preview — web push is handled separately and
 * the Firebase Messaging plugin only exists inside the native shell. All
 * Capacitor / Firebase imports live in `native-push.ts` and are loaded
 * dynamically so the web/SSR bundle never evaluates native code paths.
 *
 * On iOS this now returns a real FCM registration token (via
 * `@capacitor-firebase/messaging`), which is what our FCM HTTP v1 sender
 * expects — the previous `@capacitor/push-notifications` path returned only the
 * raw APNs token, which Firebase Admin cannot deliver to.
 */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    enableNativePush().catch((err) =>
      console.error("Push notification setup failed:", err),
    );
  }, [enabled]);
}
