import { cookies } from "next/headers";
import { handleError, ok } from "@/lib/api";
import { SESSION_COOKIE, revokeSession } from "@/lib/auth/session";

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await revokeSession(token);
    const res = ok({ loggedOut: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
