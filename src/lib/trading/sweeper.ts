import { sweepOpenPositions, settleFixedTimeDeals } from "./engine";
import { prisma } from "@/lib/db";

/**
 * Background maintenance loop. Runs once per server process.
 * In production this would live in a dedicated worker; on serverless
 * it is triggered lazily by API traffic (acceptable for demo scale).
 */
const g = globalThis as unknown as { __bdoSweeperStarted?: boolean };

export function startSweeper() {
  if (g.__bdoSweeperStarted) return;
  g.__bdoSweeperStarted = true;

  const loop = async () => {
    try {
      await sweepOpenPositions();
      await settleFixedTimeDeals();
    } catch (e) {
      console.error("[sweeper]", e);
    }
  };

  setInterval(loop, 3000).unref?.();
  void loop();
}
