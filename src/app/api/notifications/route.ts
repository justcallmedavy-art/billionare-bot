import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok } from "@/lib/api";
import { z } from "zod";
import { parseBody } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
    return ok({ notifications, unread });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, z.object({ markAllRead: z.boolean().optional(), id: z.string().optional() }));
    if (body.markAllRead) {
      await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    } else if (body.id) {
      await prisma.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
    }
    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
