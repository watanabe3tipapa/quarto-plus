import path from "node:path";
import fs from "node:fs";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const SITE_DIR = path.join(ROOT, "build/site");
export const ADOC_HTML_DIR = path.join(ROOT, "build/adoc-html");
export const ADOC_FRAG_DIR = path.join(ROOT, "build/adoc-frag");
export const ADOC_QMD_DIR = path.join(ROOT, "adoc-pages");
export const HARMONIZED_DIR = path.join(ROOT, "build/site-harmonized");
export const ASSET_DIR = path.join(HARMONIZED_DIR, "assets");
export const DIST_DIR = path.join(ROOT, "dist");
export const ADOC_DIR = path.join(ROOT, "adoc");
export const ADOC_GLOB = path.join(ADOC_DIR, "**/*.adoc");
export const THEMES_DIR = path.join(ROOT, "themes");

export const BASEURL = process.env.QP_BASEURL || "";

export const DEFAULT_TOC_MODE = process.env.QP_TOC_MODE || "auto";

export const TOC_EXCLUDE_PREFIXES = (process.env.QP_TOC_EXCLUDE || "index")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function loadDict() {
  const dictPath = path.join(ROOT, "tools/dict.json");
  if (fs.existsSync(dictPath)) {
    return JSON.parse(fs.readFileSync(dictPath, "utf8"));
  }
  return {};
}
