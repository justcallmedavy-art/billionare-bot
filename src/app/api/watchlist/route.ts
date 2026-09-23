import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok } from "@/lib/api";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const items = await prisma.watchlistItem.findMany({
      where: { userId: user.id },
      select: { assetId: true },
    });
    return ok({ assetIds: items.map((i) => i.assetId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, z.object({ symbol: z.string().min(3).max(16) }));
    const asset = await prisma.asset.findUnique({ where: { symbol: body.symbol.toUpperCase() } });
    if (!asset) return ok({ favorited: false });
    const existing = await prisma.watchlistItem.findUnique({
      where: { userId_assetId: { userId: user.id, assetId: asset.id } },
    });
    if (existing) {
      await prisma.watchlistItem.delete({ where: { id: existing.id } });
      return ok({ favorited: false });
    }
    await prisma.watchlistItem.create({ data: { userId: user.id, assetId: asset.id } });
    return ok({ favorited: true });
  } catch (e) {
    return handleError(e);
  }
}
