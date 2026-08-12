import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import { HARMONIZED_DIR, BASEURL } from "./config.mjs";

const HTML_GLOB = path.join(HARMONIZED_DIR, "**/*.html");

function isRemote(href) {
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith("//") ||
    href.startsWith("data:") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

async function loadIds(fileAbs) {
  const html = await fs.readFile(fileAbs, "utf8");
  const $ = cheerio.load(html);
  const ids = new Set();
  const dup = new Set();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    if (ids.has(id)) dup.add(id);
    ids.add(id);
  });
  return { ids, dup };
}

async function main() {
  const files = await globFiles(HTML_GLOB);
  const idCache = new Map();
  const existsCache = new Map();
  let errors = 0;

  const fileExists = async (abs) => {
    if (existsCache.has(abs)) return existsCache.get(abs);
    let ok = true;
    try {
      await fs.access(abs);
    } catch {
      ok = false;
    }
    existsCache.set(abs, ok);
    return ok;
  };

  const isInsideSite = (abs) => {
    const rel = path.relative(HARMONIZED_DIR, abs);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  };

  for (const htmlAbs of files) {
    const html = await fs.readFile(htmlAbs, "utf8");
    const $ = cheerio.load(html);
    const { ids, dup } = await loadIds(htmlAbs);
    idCache.set(htmlAbs, ids);

    for (const d of dup) {
      errors++;
      console.log(`[dup-id] ${path.relative(HARMONIZED_DIR, htmlAbs)} id="${d}"`);
    }

    const links = [];
    $("a[href]").each((_, a) => {
      links.push($(a).attr("href"));
    });
    $("img[src]").each((_, a) => {
      links.push($(a).attr("src"));
    });

    for (const href of links) {
      if (!href || isRemote(href)) continue;

      if (!href.includes("#")) {
        if (!href.endsWith(".html") && !/\.(png|jpe?g|gif|svg|webp|ico|pdf|css|js|woff2?|mp4|webm)$/i.test(href)) {
          continue;
        }
        let targetAbs = path.resolve(path.dirname(htmlAbs), href);
        if (href.startsWith(`${BASEURL}/`)) {
          targetAbs = path.join(HARMONIZED_DIR, href.replace(`${BASEURL}/`, ""));
        }
        if (targetAbs.endsWith(".html") || /\.(png|jpe?g|gif|svg|webp|ico|pdf|css|js|woff2?|mp4|webm)$/i.test(targetAbs)) {
          if (isInsideSite(targetAbs) && !(await fileExists(targetAbs))) {
            errors++;
            console.log(
              `[missing-file] ${path.relative(HARMONIZED_DIR, htmlAbs)} -> "${href}"`
            );
          }
        }
        continue;
      }

      const hashIdx = href.indexOf("#");
      const target = href.slice(0, hashIdx);
      const frag = href.slice(hashIdx + 1);
      if (!frag) continue;

      if (!target) {
        if (!ids.has(frag)) {
          errors++;
          console.log(
            `[missing-frag] ${path.relative(HARMONIZED_DIR, htmlAbs)} -> "#${frag}"`
          );
        }
        continue;
      }

      let targetAbs = path.resolve(path.dirname(htmlAbs), target);
      if (target.startsWith(`${BASEURL}/`)) {
        targetAbs = path.join(HARMONIZED_DIR, target.replace(`${BASEURL}/`, ""));
      }
      if (!targetAbs.endsWith(".html")) continue;
      if (!isInsideSite(targetAbs)) continue;

      if (!idCache.has(targetAbs)) {
        try {
          idCache.set(targetAbs, (await loadIds(targetAbs)).ids);
        } catch {
          idCache.set(targetAbs, null);
        }
      }
      const targetIds = idCache.get(targetAbs);
      if (targetIds === null) {
        errors++;
        console.log(
          `[missing-target] ${path.relative(HARMONIZED_DIR, htmlAbs)} -> "${target}"`
        );
      } else if (!targetIds.has(frag)) {
        errors++;
        console.log(
          `[missing-crossfrag] ${path.relative(HARMONIZED_DIR, htmlAbs)} -> "${target}#${frag}"`
        );
      }
    }
  }

  if (errors > 0) {
    console.log(`validate: ${errors} error(s)`);
    process.exit(1);
  }
  console.log(`validate: OK (${files.length} pages, no broken anchors)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
