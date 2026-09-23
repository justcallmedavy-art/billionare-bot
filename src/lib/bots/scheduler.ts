import { prisma } from "@/lib/db";
import { runBotOnce } from "./engine";
import { settleBotTrades } from "./settlement";
import { startSweeper } from "@/lib/trading/sweeper";

const g = globalThis as unknown as { __bdoBotLoop?: ReturnType<typeof setInterval> };

/** Single scheduler driving all bots, once per server process. */
export function startBotLoop() {
  startSweeper();
  if (g.__bdoBotLoop) return;
  g.__bdoBotLoop = setInterval(async () => {
    try {
      const running = await prisma.bot.findMany({ where: { status: "running" } });
      for (const bot of running) {
        await runBotOnce(bot);
      }
      await settleBotTrades();
    } catch (e) {
      console.error("[bots]", e);
    }
  }, 5_000);
  (g.__bdoBotLoop as unknown as { unref?: () => void }).unref?.();
}
