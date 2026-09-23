import { prisma } from "../src/lib/db";

async function main() {
  const bots = await prisma.bot.findMany();
  for (const b of bots) {
    const agg = await prisma.botTrade.groupBy({
      by: ["status"],
      where: { botId: b.id, status: { in: ["won", "lost"] } },
      _count: true,
      _sum: { pnl: true },
    });
    const trades = agg.reduce((s, a) => s + a._count, 0);
    const wins = agg.find((a) => a.status === "won")?._count ?? 0;
    const losses = agg.find((a) => a.status === "lost")?._count ?? 0;
    const pnl = agg.reduce((s, a) => s + (a._sum.pnl ?? 0), 0);
    if (trades !== b.tradeCount || wins !== b.winCount || losses !== b.lossCount || Math.abs(pnl - b.pnl) > 0.005) {
      await prisma.bot.update({
        where: { id: b.id },
        data: {
          tradeCount: trades,
          winCount: wins,
          lossCount: losses,
          pnl: Math.round(pnl * 100) / 100,
        },
      });
      console.log("fixed:", b.name, "| trades", trades, "| W/L", wins + "/" + losses, "| pnl", pnl.toFixed(2));
    } else {
      console.log("ok:", b.name);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
