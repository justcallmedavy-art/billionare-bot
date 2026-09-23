import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { z } from "zod";
import { pauseBot } from "@/lib/bots/engine";

const actionSchema = z.object({ action: z.enum(["start", "pause", "stop", "kill"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, actionSchema);
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);

    if (body.action === "start") {
      if (bot.demo === false) {
        return fail("Real-money bots are disabled on this deployment.", 501);
      }
      await prisma.bot.update({
        where: { id: bot.id },
        data: { status: "running", pauseReason: "", startedAt: bot.startedAt ?? new Date() },
      });
      await prisma.botLog.create({
        data: { botId: bot.id, level: "info", message: "Bot started (DEMO paper execution)" },
      });
      return ok({ status: "running" });
    }

    if (body.action === "pause") {
      await pauseBot(bot.id, "Paused by user.");
      return ok({ status: "paused" });
    }

    // stop & kill both halt the bot; kill also cancels nothing real because
    // demo paper trades have nothing to cancel — they simply expire.
    await prisma.bot.update({
      where: { id: bot.id },
      data: { status: "stopped", pauseReason: body.action === "kill" ? "Emergency stop (kill switch)" : "" },
    });
    await prisma.botLog.create({
      data: {
        botId: bot.id, level: body.action === "kill" ? "warn" : "info",
        message: body.action === "kill" ? "KILL SWITCH activated — bot halted." : "Bot stopped by user.",
      },
    });
    return ok({ status: "stopped" });
  } catch (e) {
    return handleError(e);
  }
}
