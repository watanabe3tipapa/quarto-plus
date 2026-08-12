import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import { HARMONIZED_DIR } from "./config.mjs";

const HTML_GLOB = path.join(HARMONIZED_DIR, "**/*.html");

function cleanText(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function collectSectionText($, headingEl) {
  let text = cleanText($(headingEl).text());
  $(headingEl)
    .nextUntil("h2, h3, h4, h5, h6")
    .each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "nav") return;
      text += "\n" + cleanText($(el).text());
    });
  return text;
}

async function main() {
  const files = await globFiles(HTML_GLOB);
  const records = [];

  for (const htmlAbs of files) {
    const siteRel = path.relative(HARMONIZED_DIR, htmlAbs).split(path.sep).join("/");
    const html = await fs.readFile(htmlAbs, "utf8");
    const $ = cheerio.load(html);

    const titleEl = $("h1.title").first();
    const title = titleEl.length
      ? cleanText(titleEl.text())
      : cleanText($("title").first().text()) || siteRel;

    const headings = $("h2, h3, h4, h5, h6");

    const introEl = $("main").first().contents().first();
    const introText = introEl.length ? cleanText(introEl.text()) : "";
    records.push({
      objectID: siteRel,
      href: siteRel,
      title,
      section: "",
      text: introText,
    });

    headings.each((_, el) => {
      const $el = $(el);
      const id = $el.attr("id");
      if (!id) return;
      const href = `${siteRel}#${id}`;
      records.push({
        objectID: href,
        href,
        title,
        section: cleanText($el.text()),
        text: collectSectionText($, el),
      });
    });
  }

  records.sort((a, b) => (a.href < b.href ? -1 : 1));
  await fs.writeFile(
    path.join(HARMONIZED_DIR, "search.json"),
    JSON.stringify(records, null, 0)
  );
  console.log(`rebuild-search: ${records.length} entries -> search.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
