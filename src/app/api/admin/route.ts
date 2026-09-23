import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/server";
import { handleError, ok, fail } from "@/lib/api";
import { parseBody } from "@/lib/api";
import { z } from "zod";
import { clientIp } from "@/lib/security/client-ip";

/**
 * Admin API. IMPORTANT: admins manage accounts (status, verification,
 * visibility), never trade outcomes. There is deliberately no endpoint that
 * can influence balances, prices, or win/loss results.
 */

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        demoAccount: true,
        wallet: true,
        _count: { select: { positions: true, fixedTimeDeals: true, bots: true, sessions: true } },
      },
    });

    const [totals, deposits, withdrawals, pendingWd, runningBots, openPositions, openDeals, logs] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.aggregate({ where: { type: "deposit", status: "completed" }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { type: "withdrawal" }, _sum: { amount: true }, _count: true }),
      prisma.transaction.count({ where: { type: "withdrawal", status: "pending" } }),
      prisma.bot.count({ where: { status: "running" } }),
      prisma.position.count({ where: { status: "open" } }),
      prisma.fixedTimeDeal.count({ where: { status: "open" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { email: true } } } }),
    ]);

    return ok({
      metrics: {
        users: totals,
        demoAccounts: users.filter((u) => u.demoAccount).length,
        runningBots,
        openPositions: openPositions + openDeals,
        depositsCompleted: deposits._count,
        depositsVolume: deposits._sum.amount ?? 0,
        withdrawalsTotal: withdrawals._count,
        withdrawalsPending: pendingWd,
        // Demo economy aggregates — clearly internal, not user-facing claims
        demoBalanceTotal: users.reduce((s, u) => s + (u.demoAccount?.balance ?? 0), 0),
      },
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        country: u.country,
        status: u.status,
        role: u.role,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        demoBalance: u.demoAccount?.balance ?? null,
        walletBalance: u.wallet?.balance ?? 0,
        positions: u._count.positions,
        deals: u._count.fixedTimeDeals,
        bots: u._count.bots,
        sessions: u._count.sessions,
      })),
      auditLog: logs.map((l) => ({
        id: l.id, action: l.action, detail: l.detail, ip: l.ip,
        email: l.user?.email ?? "system", createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  userId: z.string(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  verifyEmail: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseBody(req, patchSchema);
    const target = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!target) return fail("User not found", 404);

    if (target.id === admin.id && body.status && body.status !== "active") {
      return fail("You cannot suspend or ban your own admin account.", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.verifyEmail) data.emailVerified = true;
    await prisma.user.update({ where: { id: target.id }, data });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: body.status ? `admin.user.${body.status}` : "admin.user.verify",
        detail: `target=${target.email}`,
        ip: clientIp(req),
      },
    });

    // Revoking sessions on suspension takes effect immediately
    if (body.status && body.status !== "active") {
      await prisma.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
