import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionUser, type SessionUser } from "./session";

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}
