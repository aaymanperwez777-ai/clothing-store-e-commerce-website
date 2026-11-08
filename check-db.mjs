import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("Tables found in Neon:");
  console.table(result.rows);
} catch (error) {
  console.error("Database check failed:", error.message);
} finally {
  await pool.end();
}
