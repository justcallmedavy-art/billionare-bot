import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("prisma/dev.db");
const row = db.prepare("SELECT email, fullName, length(email) AS len FROM User WHERE email LIKE '%otyhkm%'").get();
console.log(JSON.stringify(row));
db.close();
