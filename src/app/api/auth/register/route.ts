import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, newReferralCode } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { registerSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/client-ip";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60_000);
    if (!rl.allowed) return fail("Too many attempts. Please wait a minute and try again.", 429, { retryAfterSec: rl.retryAfterSec });

    const body = await parseBody(req, registerSchema);
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("An account with this email already exists.", 409);

    let referredById: string | null = null;
    if (body.referralCode) {
      const ref = await prisma.user.findUnique({ where: { referralCode: body.referralCode.toUpperCase() } });
      if (ref) referredById = ref.id;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(body.password),
        fullName: body.fullName.trim(),
        country: body.country.trim(),
        phone: body.phone ?? "",
        referralCode: newReferralCode(),
        referredById,
      },
    });

    await prisma.demoAccount.create({
      data: { userId: user.id, balance: Number(process.env.DEMO_STARTING_BALANCE || 10000) },
    });
    await prisma.wallet.create({ data: { userId: user.id } });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Welcome to Billinare Deal Option",
        body: "Your demo account is funded with simulated balance. Demo trading carries no real-money risk.",
      },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "auth.register", detail: `ip=${ip}` },
    });

    const { token, expiresAt } = await createSession(user.id, { ip, device: req.headers.get("user-agent") ?? "" });
    const res = ok({ userId: user.id, email: user.email }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      path: "/",
    });
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
