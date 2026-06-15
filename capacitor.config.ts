import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the PupXpress native (iOS / Android) builds.
 *
 * The app is a server-rendered TanStack Start web app, so the native shell
 * loads the hosted site directly via `server.url`. This MUST be the published,
 * publicly-accessible production URL — NOT a Lovable `id-preview--…` URL.
 *
 * Preview URLs require a Lovable login and return a 302 redirect to an auth
 * wall, which the iOS WebView cannot pass — the result is a blank white screen
 * on a real device even though the web preview works in a logged-in browser.
 *
 * To build natively:
 *   1. Export the project to GitHub and `git clone` it locally.
 *   2. `npm install`
 *   3. `npx cap add ios` and/or `npx cap add android`
 *   4. `npm run build`
 *   5. `npx cap sync ios`
 *   6. Open Xcode, confirm the Bundle Identifier is `com.pupxpress.app`,
 *      then Archive + upload to TestFlight.
 */
const config: CapacitorConfig = {
  appId: "com.pupxpress.app",
  appName: "PupXpress",
  webDir: "dist",
  server: {
    // Published production URL — must be publicly reachable (HTTP 200) without
    // a login wall. Verified: https://pupexpress.lovable.app returns 200.
    url: "https://pupexpress.lovable.app",
    // HTTPS only — no cleartext needed and ATS stays strict for security.
    cleartext: false,
  },
  ios: {
    // Show the native launch screen until the web content is ready instead of
    // flashing a white WebView.
    backgroundColor: "#ffffff",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
