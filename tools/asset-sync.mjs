import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import { HARMONIZED_DIR, ASSET_DIR, BASEURL } from "./config.mjs";

const HTML_GLOB = path.join(HARMONIZED_DIR, "**/*.html");

function isRemote(src) {
  return (
    /^https?:\/\//i.test(src) ||
    src.startsWith("//") ||
    src.startsWith("data:")
  );
}

async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function assetRelFrom(htmlAbs) {
  const rel = path.relative(path.dirname(htmlAbs), ASSET_DIR).split(path.sep).join("/");
  return rel ? `${rel}/` : "assets/";
}

async function main() {
  const files = await globFiles(HTML_GLOB);
  await fs.mkdir(ASSET_DIR, { recursive: true });

  let updated = 0;

  for (const htmlAbs of files) {
    const html = await fs.readFile(htmlAbs, "utf8");
    const $ = cheerio.load(html);
    const imgs = $("img[src]");
    if (imgs.length === 0) continue;

    const prefix = assetRelFrom(htmlAbs);
    let changed = false;

    for (let i = 0; i < imgs.length; i++) {
      const img = imgs.get(i);
      const src = $(img).attr("src");
      if (!src || isRemote(src)) continue;

      if (src.startsWith(`${BASEURL}/`)) {
        const resolved = path.join(HARMONIZED_DIR, src.replace(`${BASEURL}/`, ""));
        const newSrc = await copyToAssets(resolved, prefix);
        if (newSrc && newSrc !== src) {
          $(img).attr("src", newSrc);
          changed = true;
        }
        continue;
      }

      const abs = path.resolve(path.dirname(htmlAbs), src);
      const newSrc = await copyToAssets(abs, prefix);
      if (newSrc && newSrc !== src) {
        $(img).attr("src", newSrc);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(htmlAbs, $.html());
      updated++;
    }
  }

  console.log(`asset-sync: updated ${updated} html files -> ${ASSET_DIR}`);

  async function copyToAssets(absSrc, prefix) {
    if (absSrc.startsWith(`${ASSET_DIR}${path.sep}`)) return null;
    try {
      await fs.access(absSrc);
    } catch {
      return null;
    }
    const hash = await sha256File(absSrc);
    const name = path.basename(absSrc);
    const targetRel = `${hash}-${name}`;
    const targetAbs = path.join(ASSET_DIR, targetRel);
    try {
      await fs.access(targetAbs);
    } catch {
      await fs.copyFile(absSrc, targetAbs);
    }
    return `${prefix}${targetRel}`;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
