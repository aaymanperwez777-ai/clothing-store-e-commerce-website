import dotenv from "dotenv";
import { Pool } from "pg";
import { mkdir, writeFile, rename, rm, copyFile } from "node:fs/promises";

dotenv.config({ path: ".env.local" });

const ids = [
  36510848,37831772,8505244,32414872,29346778,
  13875140,18549540,8126912,35610289,8346025,
  12456333,37890859,5602404,15694154,8505248,
  35768625,8346032,17340238,35043255,8505240,
  36510860,3316931,3754172,10356188,3724367,
  4258481,34966923,29844001,28497480,26769894,
  36344686,19989610,22719295,8970899,29998736,
  14967412,20038945,20417442,17858294,9775718,
  33780926,20340064,19845037,37056580,14837866,
  8590235,15988339,27081946,27721759,30589840
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const staging = "public/images/products/.image-staging";
const target = "public/images/products";

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env.local");
  if (new Set(ids).size !== 50) throw new Error("Photo IDs are not unique.");

  const { rows } = await pool.query(
    "SELECT id FROM product_images ORDER BY id"
  );

  if (rows.length !== 50) {
    throw new Error(`Expected 50 image records, found ${rows.length}.`);
  }

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  console.log("Downloading 50 different male fashion photos...");

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;

    const response = await fetch(url);
    const type = response.headers.get("content-type") || "";

    if (!response.ok || !type.includes("image")) {
      throw new Error(`Photo ${id} failed. No database changes made.`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 10000) throw new Error(`Photo ${id} is invalid.`);

    const filename = `catalog-${String(i + 1).padStart(3, "0")}.jpg`;
    await writeFile(`${staging}/${filename}`, data);
    console.log(`Downloaded ${i + 1}/50`);
  }

  await mkdir(target, { recursive: true });

  for (let i = 0; i < ids.length; i++) {
    const filename = `catalog-${String(i + 1).padStart(3, "0")}.jpg`;
    await rename(`${staging}/${filename}`, `${target}/${filename}`);
  }

  const aliases = [
    "tee-black.jpg", "hoodie-acid.jpg", "cargo-olive.jpg",
    "tee-graphic.jpg", "puffer-black.jpg", "denim-wide.jpg",
    "cap-snap.jpg", "sweat-cream.jpg"
  ];

  for (let i = 0; i < aliases.length; i++) {
    await copyFile(`${target}/catalog-${String(i + 1).padStart(3, "0")}.jpg`,
                    `${target}/${aliases[i]}`);
  }

  await copyFile(`${target}/catalog-009.jpg`, "public/images/hero.jpg");

  await pool.query("BEGIN");
  try {
    for (let i = 0; i < rows.length; i++) {
      await pool.query(
        "UPDATE product_images SET url = $1 WHERE id = $2",
        [`/images/products/catalog-${String(i + 1).padStart(3, "0")}.jpg`, rows[i].id]
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  console.log("\nSUCCESS: 50 unique images installed and database updated.");
  console.log("Products, prices, stock, users and orders were preserved.");
} catch (error) {
  console.error("\nSTOPPED:", error.message);
} finally {
  await rm(staging, { recursive: true, force: true });
  await pool.end();
}
