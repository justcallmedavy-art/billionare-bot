import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/server";
import { handleError, ok } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    const txs = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { email: true, fullName: true } } },
    });
    return ok({
      transactions: txs.map((t) => ({
        id: t.id,
        email: t.user.email,
        name: t.user.fullName,
        type: t.type,
        demo: t.demo,
        amount: t.amount,
        method: t.method,
        status: t.status,
        reference: t.reference,
        createdAt: t.createdAt,
        processedAt: t.processedAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
