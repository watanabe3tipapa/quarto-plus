import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import { HARMONIZED_DIR, ASSET_DIR, BASEURL } from "./config.mjs";

const HTML_GLOB = path.join(HARMONIZED_DIR, "**/*.html");
const CSS_GLOB = path.join(HARMONIZED_DIR, "**/*.css");

function isRemote(src) {
  return (
    /^https?:\/\//i.test(src) ||
    src.startsWith("//") ||
    src.startsWith("data:") ||
    src.startsWith("mailto:") ||
    src.startsWith("tel:") ||
    src.startsWith("#")
  );
}

async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function copyToAssets(absSrc) {
  if (!absSrc || absSrc.startsWith(`${ASSET_DIR}${path.sep}`)) return null;
  try {
    await fs.access(absSrc);
  } catch {
    return null;
  }
  const hash = await sha256File(absSrc);
  const targetRel = `${hash}-${path.basename(absSrc)}`;
  const targetAbs = path.join(ASSET_DIR, targetRel);
  try {
    await fs.access(targetAbs);
  } catch {
    await fs.copyFile(absSrc, targetAbs);
  }
  return targetAbs;
}

function relFrom(baseAbs, targetAbs) {
  const rel = path.relative(path.dirname(baseAbs), targetAbs).split(path.sep).join("/");
  return rel ? rel : path.basename(targetAbs);
}

function resolveLocalAbs(fromAbs, url) {
  if (url.startsWith(`${BASEURL}/`)) {
    return path.join(HARMONIZED_DIR, url.replace(`${BASEURL}/`, ""));
  }
  return path.resolve(path.dirname(fromAbs), url);
}

async function processUrl(url, fromAbs) {
  const trimmed = (url || "").trim();
  if (!trimmed || isRemote(trimmed)) return null;
  const targetAbs = await copyToAssets(resolveLocalAbs(fromAbs, trimmed));
  if (!targetAbs) return null;
  const newUrl = relFrom(fromAbs, targetAbs);
  return newUrl === trimmed ? null : newUrl;
}

async function processSrcset(srcset, fromAbs) {
  const parts = srcset.split(",");
  const out = [];
  let changed = false;
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) {
      out.push(raw);
      continue;
    }
    const m = part.match(/^(\S+)(\s+.+)?$/);
    const url = m[1];
    const descriptor = m[2] ?? "";
    const newUrl = await processUrl(url, fromAbs);
    if (newUrl) {
      out.push(`${newUrl}${descriptor}`);
      changed = true;
    } else {
      out.push(part);
    }
  }
  return { value: out.join(", "), changed };
}

async function rewriteHtml(htmlAbs, $) {
  let changed = false;

  const maybeRewrite = async (el, attr) => {
    const value = $(el).attr(attr);
    if (!value) return;
    const newUrl = await processUrl(value, htmlAbs);
    if (newUrl) {
      $(el).attr(attr, newUrl);
      changed = true;
    }
  };

  const imgEls = $("img");
  for (let i = 0; i < imgEls.length; i++) {
    const el = imgEls.get(i);
    await maybeRewrite(el, "src");
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const res = await processSrcset(srcset, htmlAbs);
      if (res.changed) {
        $(el).attr("srcset", res.value);
        changed = true;
      }
    }
  }

  const sourceEls = $("source");
  for (let i = 0; i < sourceEls.length; i++) {
    const el = sourceEls.get(i);
    await maybeRewrite(el, "src");
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const res = await processSrcset(srcset, htmlAbs);
      if (res.changed) {
        $(el).attr("srcset", res.value);
        changed = true;
      }
    }
  }

  const videoEls = $("video, audio");
  for (let i = 0; i < videoEls.length; i++) {
    const el = videoEls.get(i);
    await maybeRewrite(el, "poster");
    await maybeRewrite(el, "src");
  }

  return changed;
}

async function rewriteCssFile(cssAbs) {
  const css = await fs.readFile(cssAbs, "utf8");
  if (!/url\(/i.test(css)) return false;

  const re = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;
  let changed = false;
  let result = "";
  let last = 0;
  let m;
  while ((m = re.exec(css)) !== null) {
    const whole = m[0];
    const quote = m[1];
    const url = m[2].trim();
    const newUrl = await processUrl(url, cssAbs);
    if (newUrl) {
      result += css.slice(last, m.index) + `url(${quote}${newUrl}${quote})`;
      changed = true;
    } else {
      result += css.slice(last, m.index) + whole;
    }
    last = m.index + whole.length;
  }
  result += css.slice(last);

  if (changed) {
    await fs.writeFile(cssAbs, result);
    return true;
  }
  return false;
}

async function main() {
  const files = await globFiles(HTML_GLOB);
  await fs.mkdir(ASSET_DIR, { recursive: true });

  let updated = 0;

  for (const htmlAbs of files) {
    const html = await fs.readFile(htmlAbs, "utf8");
    const $ = cheerio.load(html);
    const changed = await rewriteHtml(htmlAbs, $);
    if (changed) {
      await fs.writeFile(htmlAbs, $.html());
      updated++;
    }
  }

  const cssFiles = await globFiles(CSS_GLOB);
  let updatedCss = 0;
  for (const cssAbs of cssFiles) {
    if (await rewriteCssFile(cssAbs)) updatedCss++;
  }

  console.log(
    `asset-sync: updated ${updated} html files, ${updatedCss} css files -> ${ASSET_DIR}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
