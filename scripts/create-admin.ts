import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  const name = process.env.ADMIN_SETUP_NAME?.trim();
  const email = process.env.ADMIN_SETUP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SETUP_PASSWORD;

  if (!name || !email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid name, email and password.");
  }

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const { db, pool } = await import("../src/db");
  const { users } = await import("../src/db/schema");

  try {
    const existing = await db.select().from(users)
      .where(eq(users.email, email)).limit(1);

    if (existing.length > 0) {
      await db.update(users)
        .set({ role: "admin" })
        .where(eq(users.id, existing[0].id));

      console.log("\nSUCCESS: Existing account promoted to administrator.");
      console.log("Email:", email);
      console.log("Existing password and account details were preserved.");
    } else {
      const passwordHash = await bcrypt.hash(password, 12);

      await db.insert(users).values({
        name,
        email,
        passwordHash,
        role: "admin",
      });

      console.log("\nSUCCESS: New administrator account created.");
      console.log("Email:", email);
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("\nADMIN SETUP FAILED:", error.message);
  process.exitCode = 1;
});
