import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the PupXpress native (iOS / Android) builds.
 *
 * The app is a server-rendered TanStack Start web app, so the native shell
 * loads the hosted site directly via `server.url`. This keeps a single source
 * of truth (the deployed web app) and gives instant updates without re-shipping
 * the native binary for every change.
 *
 * To build natively:
 *   1. Export the project to GitHub and `git clone` it locally.
 *   2. `npm install`
 *   3. `npx cap add ios` and/or `npx cap add android`
 *   4. `npx cap sync`
 *   5. `npx cap run ios` / `npx cap run android` (requires Xcode / Android Studio)
 *
 * For production, point `server.url` at your published URL (or remove `server`
 * entirely and bundle a static build).
 */
const config: CapacitorConfig = {
  appId: "app.pupxpress.dogride",
  appName: "PupXpress",
  webDir: "dist",
  server: {
    // Live-reload / hosted shell. Replace with your published URL when live.
    url: "https://id-preview--4aeee279-3ae2-4066-8a90-54530c6925d4.lovable.app",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
