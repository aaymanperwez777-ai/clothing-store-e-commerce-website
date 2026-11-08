import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total_images,
      COUNT(*) FILTER (WHERE url LIKE '/images/%') AS missing_local_paths,
      COUNT(*) FILTER (WHERE url LIKE 'https://%') AS external_urls,
      COUNT(*) FILTER (WHERE url LIKE '/uploads/%') AS uploaded_images
    FROM product_images;
  `);

  console.table(result.rows);
} finally {
  await pool.end();
}
