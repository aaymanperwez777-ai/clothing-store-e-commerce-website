import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM users) AS users;
  `);

  console.table(result.rows);
} catch (error) {
  console.error("Check failed:", error.message);
} finally {
  await pool.end();
}
