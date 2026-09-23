import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("prisma/dev.db");
const rows = db.prepare("SELECT id, email, fullName, referralCode, referredById, createdAt FROM User ORDER BY createdAt DESC LIMIT 8").all();
console.log(JSON.stringify(rows, null, 1));
db.close();
