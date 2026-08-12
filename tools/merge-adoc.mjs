import fs from "node:fs/promises";
import path from "node:path";
import { globFiles } from "./lib/glob.mjs";
import { SITE_DIR, ADOC_QMD_DIR } from "./config.mjs";

async function main() {
  const files = await globFiles(path.join(ADOC_QMD_DIR, "**/*"), {
    exclude: [".qmd"],
  });
  let copied = 0;

  for (const srcAbs of files) {
    const rel = path.relative(ADOC_QMD_DIR, srcAbs);
    const destAbs = path.join(SITE_DIR, rel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.copyFile(srcAbs, destAbs);
    copied++;
  }

  console.log(`merge: ${copied} adoc resources -> ${SITE_DIR} (overwrite)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
