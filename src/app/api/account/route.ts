import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok, fail } from "@/lib/api";
import { marketEngine } from "@/lib/market/engine";
import { computeForexPnl } from "@/lib/trading/engine";
import { REAL_TRADING_ENABLED, getProviderInfo } from "@/lib/providers";
import { z } from "zod";
import { parseBody } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const [demoAcc, wallet, derivAcc] = await Promise.all([
      prisma.demoAccount.findUnique({ where: { userId: user.id } }),
      prisma.wallet.findUnique({ where: { userId: user.id } }),
      prisma.derivAccount.findUnique({ where: { userId: user.id } }),
    ]);
    const positions = await prisma.position.findMany({
      where: { userId: user.id, status: "open", demo: true },
      include: { asset: true },
    });
    let openPnl = 0;
    let marginUsed = 0;
    for (const p of positions) {
      const st = marketEngine.getState(p.asset.symbol);
      const current = st?.mid ?? p.entryPrice;
      openPnl += computeForexPnl(p.side as "buy" | "sell", p.size, p.asset.contractSize, p.entryPrice, current, p.asset.digits);
      marginUsed += p.margin;
    }
    const deals = await prisma.fixedTimeDeal.findMany({
      where: { userId: user.id, status: "open", demo: true },
    });
    const stakedInDeals = deals.reduce((s, d) => s + d.stake, 0);

    const balance = demoAcc?.balance ?? 0;
    const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });

    return ok({
      user: {
        id: user.id, email: user.email, fullName: user.fullName,
        role: user.role, emailVerified: user.emailVerified,
      },
      demo: {
        balance, currency: demoAcc?.currency ?? "USD",
        openPnl: Math.round(openPnl * 100) / 100,
        marginUsed: Math.round(marginUsed * 100) / 100,
        stakedInFixedTime: Math.round(stakedInDeals * 100) / 100,
        equity: Math.round((balance + openPnl) * 100) / 100,
      },
      wallet: { balance: wallet?.balance ?? 0, currency: wallet?.currency ?? "USD" },
      real: {
        linked: !!derivAcc,
        balance: derivAcc?.balance ?? 0,
        currency: derivAcc?.currency ?? "USD",
        balanceFrom: derivAcc?.balanceFrom ?? "local",
        syncedAt: derivAcc?.syncedAt?.toISOString() ?? null,
        loginId: derivAcc?.loginId ?? "",
      },
      activeAccount: user.activeAccount === "real" ? "real" : "demo",
      realTradingEnabled: REAL_TRADING_ENABLED,
      provider: getProviderInfo(),
      unreadNotifications: unread,
    });
  } catch (e) {
    return handleError(e);
  }
}

const profileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone: z.string().max(30).optional(),
  country: z.string().max(60).optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, profileSchema);
    await prisma.user.update({ where: { id: user.id }, data: body });
    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
