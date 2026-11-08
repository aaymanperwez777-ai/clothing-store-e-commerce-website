import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT p.name, pi.url
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    ORDER BY p.name
    LIMIT 15;
  `);

  console.table(result.rows);
} catch (error) {
  console.error("Database check failed:", error.message);
} finally {
  await pool.end();
}
