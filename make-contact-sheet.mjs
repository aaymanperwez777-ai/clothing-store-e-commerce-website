import sharp from "sharp";
import fs from "node:fs";

const files = fs.readdirSync("public/images/products")
  .filter(f => /^catalog-\d+\.jpg$/i.test(f))
  .sort();

const columns = 5, cellW = 200, cellH = 250;
const rows = Math.ceil(files.length / columns);
const layers = [];

for (let i = 0; i < files.length; i++) {
  const x = (i % columns) * cellW;
  const y = Math.floor(i / columns) * cellH;

  const image = await sharp(`public/images/products/${files[i]}`)
    .resize(190, 215, { fit: "contain", background: "#eeeeee" })
    .jpeg()
    .toBuffer();

  layers.push({ input: image, left: x + 5, top: y + 2 });

  const label = Buffer.from(
    `<svg width="200" height="30"><rect width="200" height="30" fill="white"/><text x="8" y="21" font-size="15" fill="black">${files[i]}</text></svg>`
  );
  layers.push({ input: label, left: x, top: y + 218 });
}

await sharp({
  create: {
    width: columns * cellW,
    height: rows * cellH,
    channels: 3,
    background: "#dddddd"
  }
}).composite(layers).jpeg({ quality: 85 })
  .toFile("public/images/contact-sheet.jpg");

console.log("Created public/images/contact-sheet.jpg");
