import { prisma } from "../src/lib/db";

async function main() {
  const r = await prisma.transaction.updateMany({
    where: { reference: { in: ["TEST-WIN-1", "TEST-WD-1"] } },
    data: { status: "cancelled", note: "Test entries reversed; balances already restored." },
  });
  console.log("marked", r.count, "test transactions as cancelled");

  // Also reconcile the deriv ledger to the wallet so the displayed real balance stays truthful
  const w = await prisma.wallet.findUnique({ where: { userId: (await prisma.user.findUnique({ where: { email: "derivprince678@gmail.com" } }))!.id } });
  await prisma.derivAccount.update({
    where: { userId: (await prisma.user.findUnique({ where: { email: "derivprince678@gmail.com" } }))!.id },
    data: { balance: w!.balance, syncedAt: new Date() },
  });
  console.log("deriv ledger synced to wallet:", w!.balance);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
