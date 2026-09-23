import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { depositSchema, withdrawalSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    const txs = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ transactions: txs });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const ipLimiter = rateLimit(`wallet:${user.id}`, 10, 60_000);
    if (!ipLimiter.allowed) return fail("Too many requests. Please wait a moment.", 429);

    const url = new URL(req.url);
    const intent = url.searchParams.get("intent");

    if (intent === "deposit") {
      const body = await parseBody(req, depositSchema);
      // Demo credit: instant, clearly labeled, and never described as real money.
      const tx = await prisma.$transaction(async (tx) => {
        const t = await tx.transaction.create({
          data: {
            userId: user.id,
            demo: true,
            type: "deposit",
            amount: body.amount,
            method: "demo_credit",
            status: "completed",
            reference: `DEMO-${Date.now()}-${user.id.slice(0, 8)}`,
            note: "Simulated demo credit — not real funds.",
            processedAt: new Date(),
          },
        });
        await tx.demoAccount.update({
          where: { userId: user.id },
          data: { balance: { increment: body.amount } },
        });
        return t;
      });
      await prisma.notification.create({
        data: { userId: user.id, type: "system", title: "Demo balance credited", body: `$${body.amount.toFixed(2)} simulated demo funds added. This is not a real deposit.` },
      });
      return ok({ transaction: tx }, { status: 201 });
    }

    if (intent === "withdraw") {
      const body = await parseBody(req, withdrawalSchema);
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet || wallet.balance < body.amount) {
        return fail("Withdrawal requests from the real wallet require a completed real deposit first. This deployment has no payment provider configured, so withdrawals remain disabled.", 400);
      }
      if (body.amount > wallet.balance) return fail("Amount exceeds wallet balance.", 400);
      const tx = await prisma.transaction.create({
        data: {
          userId: user.id, demo: false, type: "withdrawal",
          amount: body.amount, method: "demo_credit",
          reference: `WD-${Date.now()}-${user.id.slice(0, 8)}`,
          status: "pending",
          note: "Awaiting payment-provider verification.",
        },
      });
      await prisma.notification.create({
        data: { userId: user.id, type: "system", title: "Withdrawal requested", body: "Your withdrawal is pending verification." },
      });
      return ok({ transaction: tx }, { status: 201 });
    }

    return fail("Unknown wallet action", 400);
  } catch (e) {
    return handleError(e);
  }
}
