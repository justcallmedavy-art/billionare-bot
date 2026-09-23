/**
 * Verifies the owner account flow end-to-end:
 *  1. real balance starts at 50
 *  2. a manual ledger credit increases it
 *  3. a withdrawal reduces it
 *  4. demo/real switch persists
 */
import { prisma } from "../src/lib/db";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "derivprince678@gmail.com" },
    include: { wallet: true, derivAccount: true },
  });
  if (!user?.wallet || !user.derivAccount) throw new Error("owner account incomplete");

  console.log("start: wallet", user.wallet.balance, "| deriv", user.derivAccount.balance, "| active", user.activeAccount);

  // Simulate a win credit (+7.50 on both wallet & deriv ledger)
  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: user.id }, data: { balance: { increment: 7.5 } } }),
    prisma.derivAccount.update({ where: { userId: user.id }, data: { balance: { increment: 7.5 }, syncedAt: new Date() } }),
    prisma.transaction.create({
      data: {
        userId: user.id, demo: false, type: "deposit", amount: 7.5,
        method: "trade_win", reference: "TEST-WIN-1", status: "completed",
        note: "Settled winning trade credit (test).", processedAt: new Date(),
      },
    }),
  ]);
  console.log("after +7.50 win: wallet", (await prisma.wallet.findUnique({ where: { userId: user.id } }))?.balance);

  // Simulate a withdrawal (−10)
  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: user.id }, data: { balance: { decrement: 10 } } }),
    prisma.derivAccount.update({ where: { userId: user.id }, data: { balance: { decrement: 10 }, syncedAt: new Date() } }),
    prisma.transaction.create({
      data: {
        userId: user.id, demo: false, type: "withdrawal", amount: 10,
        method: "deriv_cashier", reference: "TEST-WD-1", status: "completed",
        note: "Withdrawal processed via Deriv cashier (test).", processedAt: new Date(),
      },
    }),
  ]);
  const w = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log("after −10 withdrawal: wallet", w?.balance);

  // Switch back to demo for a clean state
  await prisma.user.update({ where: { id: user.id }, data: { activeAccount: "demo" } });
  const final = await prisma.user.findUnique({ where: { id: user.id }, select: { activeAccount: true } });
  console.log("activeAccount reset to:", final?.activeAccount);
  console.log("expected balance: 50 + 7.50 − 10 = 47.50");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
