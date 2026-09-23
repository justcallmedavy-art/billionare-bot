import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok, fail, parseBody } from "@/lib/api";
import { z } from "zod";
import { REAL_TRADING_ENABLED } from "@/lib/providers";

const schema = z.object({ account: z.enum(["demo", "real"]) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, schema);

    if (body.account === "real") {
      const deriv = await prisma.derivAccount.findUnique({ where: { userId: user.id } });
      if (!deriv) {
        return fail(
          "No real account is linked to your profile yet. Link a Deriv account first — real trading and real balances only exist through a connected provider.",
          409,
        );
      }
      // REAL trading is disabled until the broker adapter is configured.
      // Switching to real is still allowed for viewing: the balance shown is
      // the synced/last-known ledger balance, clearly labelled.
      const readOnly = !REAL_TRADING_ENABLED;
      await prisma.user.update({
        where: { id: user.id },
        data: { activeAccount: "real" },
      });
      return ok({
        activeAccount: "real",
        readOnly,
        notice: readOnly
          ? "Real account selected. Balance display only — order execution activates after the Deriv connection is verified."
          : "Real account selected. Orders execute through the connected provider.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { activeAccount: body.account },
    });
    return ok({ activeAccount: body.account, readOnly: false });
  } catch (e) {
    return handleError(e);
  }
}
