import { NextResponse } from "next/server";
import { generateToken } from "@/lib/auth/session";

/**
 * GET /api/auth/deriv
 *
 * Redirects the user to Deriv's OAuth authorization page. Deriv handles the
 * credential entry entirely on their side — we never see the password.
 * A one-time state token (CSRF protection) is stored in a short-lived cookie
 * and must match on callback.
 */
export async function GET(req: Request) {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      new URL("/login?error=deriv_not_configured", req.url),
    );
  }

  const state = generateToken();
  const origin = new URL(req.url).origin;

  const authUrl = new URL("https://oauth.deriv.com/oauth2/authorize");
  authUrl.searchParams.set("app_id", appId);
  authUrl.searchParams.set("l", "EN");
  authUrl.searchParams.set("brand", "deriv");
  authUrl.searchParams.set("state", state);
  // Send state even though Deriv's legacy OAuth (which returns acctN/tokenN
  // query params) does not echo it on callback. Harmless if ignored, and
  // correct if Deriv ever starts echoing it — see callback validation.

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("deriv_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes to complete OAuth
    path: "/",
  });
  // Remember where to send the user after linking (unused for sign-in-only flow)
  res.cookies.set("deriv_oauth_return", origin, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
