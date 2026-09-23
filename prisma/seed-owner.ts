/**
 * Owner account bootstrap.
 *
 * Creates derivprince678@gmail.com (role: admin) with:
 *  - a $50 REAL ledger seeded via an explicit, audited "founder_credit"
 *    transaction (visible in wallet history — not a hidden number)
 *  - a DerivAccount stub marked local (real balance syncs once the Deriv
 *    API adapter is configured — the local figure is replaced, never faked)
 *  - a standard $10,000 demo account
 */
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const email = "derivprince678@gmail.com";
  const password = "678prince#";

  const existing = await prisma.user.findUnique({ where: { email }, include: { wallet: true, demoAccount: true, derivAccount: true } });
  if (existing) {
    console.log("owner account already exists:", existing.id);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName: "Prince",
      country: "",
      role: "admin",
      emailVerified: true,
      referralCode: "PRINCE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      demoAccount: { create: { balance: 10000, currency: "USD" } },
      wallet: { create: { balance: 50, currency: "USD" } },
      derivAccount: {
        create: {
          currency: "USD",
          balance: 50,
          balanceFrom: "local",
          syncedAt: new Date(),
        },
      },
    },
    include: { wallet: true, derivAccount: true },
  });

  // The $50 must be traceable: an explicit completed credit on the ledger.
  await prisma.transaction.create({
    data: {
      userId: user.id,
      demo: false,
      type: "deposit",
      amount: 50,
      currency: "USD",
      method: "founder_credit",
      reference: "OWNER-INITIAL",
      status: "completed",
      note: "Initial real-balance provision for the owner account.",
      processedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "system",
      title: "Real account ready",
      body: "Your real account starts at $50.00. Wins credit it, losses debit it, withdrawals reduce it. Connect Deriv to keep the balance in sync automatically.",
    },
  });

  console.log("owner created:", user.id, "| real $50 | demo $10,000");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
