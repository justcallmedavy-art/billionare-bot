import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("prisma/dev.db");

function cols(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

// --- FixedTimeDeal.durationSec ---
if (!cols("FixedTimeDeal").includes("durationSec")) {
  db.exec("ALTER TABLE FixedTimeDeal ADD COLUMN durationSec INTEGER;");
  console.log("added durationSec column");
}
const dealCount = db.prepare("SELECT COUNT(*) AS c FROM FixedTimeDeal WHERE durationSec IS NULL").get() as { c: number };
if (dealCount.c > 0) {
  db.prepare("UPDATE FixedTimeDeal SET durationSec = 60 WHERE durationSec IS NULL").run();
  console.log("backfilled durationSec on", dealCount.c, "deals");
}

// --- LoginEvent.email ---
if (!cols("LoginEvent").includes("email")) {
  db.exec("ALTER TABLE LoginEvent ADD COLUMN email TEXT;");
  console.log("added email column");
}
const events = db.prepare("SELECT id, userId FROM LoginEvent WHERE email IS NULL OR email = ''").all() as Array<{ id: string; userId: string | null }>;
for (const ev of events) {
  let email = "unknown@local";
  if (ev.userId) {
    const u = db.prepare("SELECT email FROM User WHERE id = ?").get(ev.userId) as { email: string } | undefined;
    if (u) email = u.email;
  }
  db.prepare("UPDATE LoginEvent SET email = ? WHERE id = ?").run(email, ev.id);
}
if (events.length) console.log("backfilled email on", events.length, "login events");

db.close();
console.log("done");
