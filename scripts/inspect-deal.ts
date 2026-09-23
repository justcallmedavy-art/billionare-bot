import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("prisma/dev.db");
console.log(JSON.stringify(db.prepare("SELECT id, expiresAt, openedAt, status FROM FixedTimeDeal").all(), null, 1));
db.close();
