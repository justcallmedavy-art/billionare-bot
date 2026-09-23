import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const events = await prisma.loginEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok({ events });
  } catch (e) {
    return handleError(e);
  }
}
