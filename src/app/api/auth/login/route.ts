import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { loginSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/client-ip";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`login:${ip}`, 10, 60_000);
    if (!rl.allowed) return fail("Too many login attempts. Please wait and try again.", 429, { retryAfterSec: rl.retryAfterSec });

    const body = await parseBody(req, loginSchema);
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? verifyPassword(body.password, user.passwordHash) : false;

    if (!user || !valid) {
      if (user) {
        await prisma.loginEvent.create({
          data: { userId: user.id, email: user.email, ip, device: (req.headers.get("user-agent") ?? "").slice(0, 200), success: false },
        });
      }
      return fail("Incorrect email or password.", 401);
    }
    if (user.status !== "active") {
      return fail("This account is suspended. Contact support for assistance.", 403);
    }

    await prisma.loginEvent.create({
      data: { userId: user.id, email: user.email, ip, device: (req.headers.get("user-agent") ?? "").slice(0, 200), success: true },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { token, expiresAt } = await createSession(user.id, { ip, device: req.headers.get("user-agent") ?? "" });
    const res = ok({ userId: user.id, role: user.role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: body.remember ? expiresAt : undefined,
      maxAge: body.remember ? SESSION_TTL_MS / 1000 : undefined,
      path: "/",
    });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
