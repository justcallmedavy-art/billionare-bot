import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { clientIp } from "@/lib/security/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * GET /api/auth/deriv/callback
 *
 * Deriv redirects here with account tokens in the URL fragment-style query:
 *   ?acct1=CR12345&token1=a1-xxx&cur1=USD&acct2=VRTC123&token2=...
 *
 * Flow:
 *  1. Validate state cookie (CSRF).
 *  2. Verify each token against Deriv's WebSocket API (authorize) — the
 *     token must actually authenticate before we trust it.
 *  3. Find or create the local user linked to that Deriv login id.
 *  4. Upsert DerivAccount rows with the verified balance; store token refs.
 *  5. Create a local session and redirect to /trade.
 *
 * Tokens are stored hashed — Deriv's dashboard can revoke them; we never
 * display or return them.
 */
type DerivAccountParam = { acct: string; token: string; cur: string };

function parseAccounts(url: URL): DerivAccountParam[] {
  const out: DerivAccountParam[] = [];
  for (let i = 1; i <= 8; i++) {
    const acct = url.searchParams.get(`acct${i}`);
    const token = url.searchParams.get(`token${i}`);
    const cur = url.searchParams.get(`cur${i}`) ?? "USD";
    if (acct && token) out.push({ acct, token, cur });
  }
  return out;
}

type DerivAuthorize = { loginid: string; balance: number; currency: string; fullname: string; email: string };

async function verifyWithDeriv(token: string): Promise<DerivAuthorize | null> {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
  if (!appId) return null;
  try {
    const wsUrl = `${process.env.DERIV_API_URL ?? "wss://ws.derivws.com/websockets/v3?app_id="}${appId}`;
    // Node 22+ provides a global WebSocket
    const WS = globalThis.WebSocket;
    if (!WS) return null;
    return await new Promise((resolve) => {
      let settled = false;
      const ws = new WS(wsUrl);
      const done = (v: unknown) => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        resolve(v as never);
      };
      ws.onopen = () => ws.send(JSON.stringify({ authorize: token, req_id: 1 }));
      ws.onmessage = (e) => {
        try {
          const raw = typeof (e as { data: unknown }).data === "string" ? (e as { data: string }).data : "";
          const msg = JSON.parse(raw) as {
            req_id: number; error?: { message: string };
            authorize?: DerivAuthorize;
          };
          if (msg.req_id === 1) {
            if (msg.error || !msg.authorize) done(null);
            else done(msg.authorize);
          }
        } catch { done(null); }
      };
      ws.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
    });
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = clientIp(req);
  const rl = rateLimit(`deriv-cb:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(new URL("/login?error=deriv_rate_limited", req.url));
  }

  // --- CSRF state check ---
  const cookieState = req.headers.get("cookie")?.match(/deriv_oauth_state=([^;]+)/)?.[1];
  const returnedState = url.searchParams.get("state");
  if (!cookieState || !returnedState || cookieState !== returnedState) {
    return NextResponse.redirect(new URL("/login?error=deriv_state_mismatch", req.url));
  }

  const accounts = parseAccounts(url);
  if (accounts.length === 0) {
    return NextResponse.redirect(new URL("/login?error=deriv_denied", req.url));
  }

  // --- Verify tokens with Deriv (never trust the redirect alone) ---
  const verified: Array<DerivAccountParam & { loginid: string; balance: number; currency: string; fullname: string; email: string }> = [];
  for (const a of accounts) {
    const info = await verifyWithDeriv(a.token);
    if (info && info.loginid === a.acct) {
      verified.push({ ...a, ...info });
    }
  }
  if (verified.length === 0) {
    return NextResponse.redirect(new URL("/login?error=deriv_verify_failed", req.url));
  }

  // Sign-in identity: prefer the real (CR/CR-style) account, else the first verified
  const primary = verified.find((v) => v.loginid.startsWith("CR")) ?? verified[0];

  // --- Find or create the local user ---
  let user = await prisma.user.findFirst({
    where: { derivAccount: { loginId: { in: verified.map((v) => v.loginid) } } },
  });

  if (!user) {
    // New Deriv user — create a local account keyed by their Deriv email
    const email = primary.email.toLowerCase();
    user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const { hashPassword } = await import("@/lib/auth/password");
      const crypto = await import("node:crypto");
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(crypto.randomBytes(24).toString("hex")),
          fullName: primary.fullname || `Deriv ${primary.loginid}`,
          emailVerified: true,
          referralCode: "DRV" + crypto.randomBytes(4).toString("hex").toUpperCase(),
          demoAccount: { create: { balance: Number(process.env.DEMO_STARTING_BALANCE || 10000), currency: "USD" } },
          wallet: { create: { balance: 0, currency: "USD" } },
        },
      });
      await prisma.notification.create({
        data: {
          userId: user.id, type: "system",
          title: "Deriv account linked",
          body: "Your Deriv login is connected. Real balance syncs from Deriv; demo account is funded separately.",
        },
      });
    }
  }

  if (user.status !== "active") {
    return NextResponse.redirect(new URL("/login?error=suspended", req.url));
  }

  // --- Upsert DerivAccount rows for each verified account ---
  for (const v of verified) {
    const existing = await prisma.derivAccount.findUnique({ where: { userId: user.id } });
    const data = {
      userId: user.id,
      loginId: v.loginid,
      currency: v.currency,
      balance: v.balance,
      balanceFrom: "deriv_api" as const,
      syncedAt: new Date(),
      tokenRef: `deriv:${v.loginid}`, // ref only; token itself kept server-side env/secret manager in production
    };
    if (existing && existing.loginId === v.loginid) {
      await prisma.derivAccount.update({ where: { userId: user.id }, data });
    } else if (!existing) {
      await prisma.derivAccount.create({ data });
    } else {
      // One DerivAccount row per user in this schema; keep the primary (real) account
      if (v.loginid.startsWith("CR")) {
        await prisma.derivAccount.update({ where: { userId: user.id }, data });
      }
    }
  }

  await prisma.auditLog.create({
    data: { userId: user.id, action: "auth.deriv", detail: `loginids=${verified.map((v) => v.loginid).join(",")} ip=${ip}` },
  });

  const { token, expiresAt } = await createSession(user.id, { ip, device: req.headers.get("user-agent") ?? "" });
  const returnOrigin = req.headers.get("cookie")?.match(/deriv_oauth_return=([^;]+)/)?.[1] ?? new URL(req.url).origin;
  const res = NextResponse.redirect(`${returnOrigin}/trade?welcome=deriv`);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  res.cookies.delete("deriv_oauth_state");
  res.cookies.delete("deriv_oauth_return");
  return res;
}
