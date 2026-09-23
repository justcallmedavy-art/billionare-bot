import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("prisma/dev.db");

// Prisma stores DateTimes as epoch milliseconds (INTEGER) in SQLite.
const rows = db.prepare("SELECT id, openedAt FROM FixedTimeDeal WHERE expiresAt IS NULL").all() as Array<{ id: string; openedAt: number }>;
for (const r of rows) {
  db.prepare("UPDATE FixedTimeDeal SET expiresAt = ? WHERE id = ?").run(r.openedAt + 60_000, r.id);
}
console.log("backfilled", rows.length, "rows (epoch-ms)");
db.close();
