import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { SITE_DIR, ROOT } from "./config.mjs";

const EDITOR_BUILD = path.join(ROOT, "build/editor");
const EDITOR_SITE_DIR = path.join(SITE_DIR, "editor");
const LP_HTML = path.join(SITE_DIR, "index.html");

async function copyEditorAssets() {
  const files = await fs.readdir(EDITOR_BUILD);
  await fs.mkdir(EDITOR_SITE_DIR, { recursive: true });
  const nameMap = { "index.js": "editor.js", "index.css": "editor.css" };
  const copied = [];
  for (const f of files) {
    const dest = nameMap[f] || f;
    await fs.copyFile(path.join(EDITOR_BUILD, f), path.join(EDITOR_SITE_DIR, dest));
    copied.push(dest);
  }
  return copied;
}

async function injectIntoLp() {
  let html = await fs.readFile(LP_HTML, "utf8");
  const $ = cheerio.load(html);

  if (!$("head link[href='editor/editor.css']").length) {
    $("head").append('<link rel="stylesheet" href="editor/editor.css">');
  }

  let injected = false;
  $("body").each((_, el) => {
    const $body = $(el);
    if (!$body.find("script[src='editor/editor.js']").length) {
      $body.append('<script defer src="editor/editor.js"></script>');
      injected = true;
    }
  });

  await fs.writeFile(LP_HTML, $.html());
  return injected;
}

async function main() {
  const files = await copyEditorAssets();
  const injected = await injectIntoLp();
  console.log(
    `inject-editor: copied ${files.length} assets, ${injected ? "injected script/css into" : "already present in"} index.html`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
