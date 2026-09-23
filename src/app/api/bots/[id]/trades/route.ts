import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok, fail } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);

    const trades = await prisma.botTrade.findMany({
      where: { botId: bot.id },
      orderBy: { openedAt: "desc" },
      take: 200,
    });
    return ok({ trades });
  } catch (e) {
    return handleError(e);
  }
}
