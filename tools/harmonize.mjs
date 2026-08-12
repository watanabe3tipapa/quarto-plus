import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import {
  SITE_DIR,
  HARMONIZED_DIR,
  DEFAULT_TOC_MODE,
  BASEURL,
  TOC_EXCLUDE_PREFIXES,
  loadDict,
} from "./config.mjs";
import {
  makePagePrefix,
  collectHeadings,
  computeFinalIds,
  toSiteRel,
  resolveHrefToSiteRel,
} from "./lib/idmap.mjs";
import { renderTocNested } from "./lib/toc.mjs";

const HTML_GLOB = path.join(SITE_DIR, "**/*.html");
const TOC_SELECTORS = [
  '#toc',
  'nav[role="doc-toc"]',
  'nav#TOC',
  '#TOC',
  'nav.toc',
  '[class*="toc"]',
];

async function findExistingToc($) {
  for (const sel of TOC_SELECTORS) {
    const node = $(sel).first();
    if (node.length > 0) return node;
  }
  return null;
}

function createOwnToc($) {
  let toc = $("#toc");
  if (toc.length === 0) {
    const main = $("main").first();
    if (main.length) main.prepend('<div id="toc"></div>');
    else $("body").prepend('<div id="toc"></div>');
    toc = $("#toc");
  }
  return toc;
}

function removeExistingTocs($) {
  for (const sel of TOC_SELECTORS) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const id = $el.attr("id");
      if (id === "toc" || $el.is("#TOC") || $el.attr("role") === "doc-toc") {
        $el.remove();
      }
    });
  }
}

function tocModeFromArgs(argv) {
  const i = argv.indexOf("--toc-mode");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return DEFAULT_TOC_MODE;
}

async function mirrorNonHtmlAssets() {
  const items = await globFiles(path.join(SITE_DIR, "**/*"), {
    exclude: [".html"],
  });
  let copied = 0;
  for (const srcAbs of items) {
    if (srcAbs.endsWith(".html")) continue;
    const rel = path.relative(SITE_DIR, srcAbs);
    const destAbs = path.join(HARMONIZED_DIR, rel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.copyFile(srcAbs, destAbs);
    copied++;
  }
  console.log(`harmonize: mirrored ${copied} non-html assets`);
}

async function main() {
  const mode = tocModeFromArgs(process.argv.slice(2));
  const dict = loadDict();

  const files = await globFiles(HTML_GLOB);
  files.sort();

  await mirrorNonHtmlAssets();

  const pageRecords = new Map();

  for (const absHtml of files) {
    const html = await fs.readFile(absHtml, "utf8");
    const $ = cheerio.load(html);
    const siteRel = toSiteRel(absHtml, SITE_DIR);
    if (!siteRel) continue;
    const pagePrefix = makePagePrefix(siteRel);
    const headings = collectHeadings($);
    const { idMap, textMap } = computeFinalIds(headings, pagePrefix, dict);
    const meta = headings.map((h) => ({
      oldId: h.oldId,
      finalId: h.finalId,
      text: h.text,
      level: h.level,
      tag: h.tag,
    }));
    pageRecords.set(siteRel, { absHtml, siteRel, pagePrefix, meta, idMap, textMap });
  }

  let rewritten = 0;

  for (const [siteRel, record] of pageRecords) {
    const html = await fs.readFile(record.absHtml, "utf8");
    const $ = cheerio.load(html);
    const { meta, idMap } = record;

    if (meta.length === 0) {
      const outAbs = path.join(HARMONIZED_DIR, siteRel);
      await fs.mkdir(path.dirname(outAbs), { recursive: true });
      await fs.writeFile(outAbs, html);
      continue;
    }

    const headings = collectHeadings($);
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const finalId = meta[i]?.finalId ?? h.finalId;
      $(h.el).attr("id", finalId);
      $(h.el).attr("data-anchor-id", finalId);
      h.finalId = finalId;
      h.text = meta[i]?.text ?? h.text;
      h.level = meta[i]?.level ?? h.level;
      h.tag = meta[i]?.tag ?? h.tag;
    }

    const resolveFragment = (pageRecord, frag) => {
      const direct = pageRecord.idMap.get(frag);
      if (direct) return direct;
      const byText = pageRecord.textMap.get(frag);
      if (byText) return byText;
      const asciidocPrefix = frag.startsWith("_")
        ? pageRecord.idMap.get(frag.slice(1))
        : pageRecord.idMap.get(`_${frag}`);
      if (asciidocPrefix) return asciidocPrefix;
      return null;
    };

    $("a[href]").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      const hashIdx = href.indexOf("#");
      if (hashIdx < 0) return;
      const target = href.slice(0, hashIdx);
      const frag = href.slice(hashIdx + 1);
      if (!frag) return;

      if (!target) {
        const finalFrag = resolveFragment(record, frag);
        if (finalFrag) $(a).attr("href", `#${finalFrag}`);
        return;
      }

      const targetSiteRel = resolveHrefToSiteRel(
        record.absHtml,
        SITE_DIR,
        href,
        BASEURL
      );
      if (!targetSiteRel) return;
      const targetRecord = pageRecords.get(targetSiteRel);
      if (!targetRecord) return;
      const finalFrag = resolveFragment(targetRecord, frag);
      if (!finalFrag) return;
      $(a).attr("href", `${target}#${finalFrag}`);
    });

    let tocNode = null;
    const excluded = TOC_EXCLUDE_PREFIXES.some((p) => record.pagePrefix.startsWith(p));
    if (mode === "force-own" || (mode === "auto" && !excluded)) {
      if (mode === "force-own") {
        removeExistingTocs($);
        tocNode = createOwnToc($);
      } else {
        tocNode = await findExistingToc($);
        if (!tocNode) tocNode = createOwnToc($);
      }
    } else {
      tocNode = await findExistingToc($);
    }

    if (tocNode) tocNode.html(renderTocNested(headings));

    const outAbs = path.join(HARMONIZED_DIR, siteRel);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, $.html());
    rewritten++;
  }

  console.log(
    `harmonize: ${rewritten} pages -> ${HARMONIZED_DIR} (toc-mode=${mode})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
