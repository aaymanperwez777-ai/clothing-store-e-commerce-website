import dotenv from "dotenv";
import { Pool } from "pg";
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";

dotenv.config({ path: ".env.local" });

const ids = [
  12738118,32490940,8505244,4258481,28994265,
  15591950,17117350,36510848,15694146,29971637,
  37050983,40770571,34966923,29844001,39915433,
  36344686,3027173,29998736,21967310,15792253,
  33440705,37260580,33672363,38953444,36607444,
  30415877,6732388,20038945,28532865,39069698,
  11576957,6050413,2364577,26625354,28758775,
  18031169,31526048,35689789,9537209,15760439,
  19471927,1959258,27584193,20734841,37252810,
  21967299,24509669,19895835,10470316,24029846,
  28497457,14577810,8505238,
];

const folder = "public/images/products";
const staging = `${folder}/.male-staging`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing.");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate photo IDs.");

  const { rows } = await pool.query(
    "SELECT id FROM product_images ORDER BY id"
  );
  if (rows.length !== 50) throw new Error(`Expected 50 products, found ${rows.length}.`);

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const downloaded = [];

  console.log("Checking and downloading male fashion photos...");

  for (const id of ids) {
    if (downloaded.length === 50) break;

    try {
      const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.pexels.com/"
        }
      });

      const type = response.headers.get("content-type") || "";
      if (!response.ok || !type.includes("image")) {
        console.log(`Skipped ${id}: HTTP ${response.status}`);
        continue;
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length < 10000) continue;

      const filename = `catalog-${String(downloaded.length + 1).padStart(3, "0")}.jpg`;
      await writeFile(`${staging}/${filename}`, data);
      downloaded.push(filename);
      console.log(`Verified ${downloaded.length}/50`);
    } catch {
      console.log(`Skipped ${id}: download failed`);
    }
  }

  if (downloaded.length < 50) {
    throw new Error(`Only ${downloaded.length}/50 photos verified. Existing images were not replaced.`);
  }

  await mkdir(folder, { recursive: true });

  for (const filename of downloaded) {
    await copyFile(`${staging}/${filename}`, `${folder}/${filename}`);
  }

  const aliases = [
    "tee-black.jpg", "hoodie-acid.jpg", "cargo-olive.jpg",
    "tee-graphic.jpg", "puffer-black.jpg", "denim-wide.jpg",
    "cap-snap.jpg", "sweat-cream.jpg"
  ];

  for (let i = 0; i < aliases.length; i++) {
    await copyFile(
      `${folder}/catalog-${String(i + 1).padStart(3, "0")}.jpg`,
      `${folder}/${aliases[i]}`
    );
  }

  await copyFile(`${folder}/catalog-009.jpg`, "public/images/hero.jpg");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < rows.length; i++) {
      await client.query(
        "UPDATE product_images SET url = $1 WHERE id = $2",
        [`/images/products/catalog-${String(i + 1).padStart(3, "0")}.jpg`, rows[i].id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log("\nSUCCESS: 50 replacement photos installed.");
  console.log("Product names, prices, stock and orders preserved.");
} catch (error) {
  console.error("\nSTOPPED:", error.message);
} finally {
  await rm(staging, { recursive: true, force: true });
  await pool.end();
}

