import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-only push delivery via Firebase Cloud Messaging (FCM HTTP v1).
 *
 * Delivery is best-effort: when `FCM_SERVICE_ACCOUNT` is not configured, or a
 * send fails, we log and move on so the in-app notification (the source of
 * truth) is never blocked. This mirrors the behaviour of `createNotifications`.
 *
 * Configure by storing the Firebase service-account JSON (the file you download
 * from Firebase Console → Project settings → Service accounts → Generate new
 * private key) as the secret `FCM_SERVICE_ACCOUNT`.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error("FCM_SERVICE_ACCOUNT is missing required fields.");
      return null;
    }
    return parsed;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT is not valid JSON.");
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;

  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    const jwt = `${unsigned}.${base64url(signature)}`;

    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error("FCM token exchange failed:", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      accessToken: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600),
    };
    return json.access_token;
  } catch (err) {
    console.error("FCM access-token error:", err);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body?: string | null;
  data?: Record<string, string>;
}

/**
 * Send a push notification to every registered device of the given users.
 * Invalid/expired tokens (HTTP 404/UNREGISTERED) are pruned automatically.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  const sa = loadServiceAccount();
  if (!sa || userIds.length === 0) return;

  const { data: tokens, error } = await supabaseAdmin
    .from("device_tokens")
    .select("token")
    .in("user_id", userIds);
  if (error) {
    console.error("Failed to load device tokens:", error.message);
    return;
  }
  if (!tokens || tokens.length === 0) return;

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const staleTokens: string[] = [];

  await Promise.allSettled(
    tokens.map(async ({ token }) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: payload.title,
              body: payload.body ?? "",
            },
            data: payload.data ?? {},
          },
        }),
      });
      if (res.status === 404 || res.status === 400) {
        staleTokens.push(token);
      } else if (!res.ok) {
        console.error("FCM send failed:", res.status, await res.text());
      }
    }),
  );

  if (staleTokens.length > 0) {
    await supabaseAdmin.from("device_tokens").delete().in("token", staleTokens);
  }
}
