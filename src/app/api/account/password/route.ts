import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllSessions, SESSION_COOKIE } from "@/lib/auth/session";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { passwordSchema } from "@/lib/validation/schemas";
import { z } from "zod";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, schema);

    const full = await prisma.user.findUnique({ where: { id: user.id } });
    if (!full || !verifyPassword(body.currentPassword, full.passwordHash)) {
      return fail("Current password is incorrect.", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(body.newPassword) },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "auth.password_change" },
    });

    // Revoke every session; the client is redirected to login.
    await revokeAllSessions(user.id);
    const res = ok({ changed: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
