// Creates the FIRST administrator. This is the only account made outside the app;
// every later admin is created by an existing admin on the Users and Roles page.
// Usage: npm run admin:init   (MySQL must be running: npm run db:start)
import { createInterface } from "node:readline";
import mysql from "mysql2/promise";
import { hashPassword, passwordProblem } from "../lib/password.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* fall back to the docker-compose defaults */ }

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (question, hidden = false) => new Promise((resolve) => {
  const write = rl._writeToOutput;
  rl.question(question, (answer) => {
    rl._writeToOutput = write;
    if (hidden) process.stdout.write("\n");
    resolve(answer.trim());
  });
  if (hidden) rl._writeToOutput = () => {}; // don't echo the password
});

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "treefinder",
  database: process.env.DB_NAME ?? "volunteer_db",
});

try {
  const [[{ Admins }]] = await db.query(
    "SELECT COUNT(*) AS Admins FROM UserRole ur JOIN Role r ON r.RoleID = ur.RoleID WHERE r.RoleName = 'Admin'");
  if (Admins > 0) {
    console.error("An admin already exists. Log in as that admin and use Users and Roles to add more.");
    process.exitCode = 1;
  } else {
    console.log("Create the first administrator.\n");
    const first = await ask("First name: "), last = await ask("Last name: ");
    const email = (await ask("Email (used to log in): ")).toLowerCase();
    const password = await ask("Password: ", true);
    const confirm = await ask("Confirm password: ", true);
    const problem = !first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? "Enter a first name, last name, and valid email."
      : password !== confirm ? "The passwords don't match." : passwordProblem(password);
    if (problem) {
      console.error(problem);
      process.exitCode = 1;
    } else {
      await db.beginTransaction();
      // Reuse the account if this email already registered; otherwise create it.
      await db.execute(
        `INSERT INTO Users (FName, LName, Email, PasswordHash) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE PasswordHash = VALUES(PasswordHash)`,
        [first, last, email, await hashPassword(password)]);
      await db.execute(
        `INSERT IGNORE INTO UserRole (UserID, RoleID)
         SELECT u.UserID, r.RoleID FROM Users u JOIN Role r ON r.RoleName IN ('User', 'Admin') WHERE u.Email = ?`, [email]);
      await db.commit();
      console.log(`\n${email} is now the first admin. Log in, then change the password from My Profile if you like.`);
    }
  }
} finally {
  rl.close();
  await db.end();
}
