import fs from "node:fs/promises";
import path from "node:path";
import { globFiles } from "./lib/glob.mjs";
import { HARMONIZED_DIR, DIST_DIR } from "./config.mjs";

async function main() {
  const items = await globFiles(path.join(HARMONIZED_DIR, "**/*"));
  let copied = 0;

  for (const srcAbs of items) {
    const rel = path.relative(HARMONIZED_DIR, srcAbs);
    if (isStaleImagesRel(rel)) continue;
    const destAbs = path.join(DIST_DIR, rel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.copyFile(srcAbs, destAbs);
    copied++;
  }

  await fs.writeFile(path.join(DIST_DIR, ".nojekyll"), "");

  console.log(`copy-dist: ${copied} files -> ${DIST_DIR}`);
}

function isStaleImagesRel(rel) {
  return rel.split(path.sep).includes("images");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
