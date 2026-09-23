import { handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/server";
import { revokeAllSessions, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  try {
    const user = await requireUser();
    await revokeAllSessions(user.id);
    const res = ok({ revoked: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
