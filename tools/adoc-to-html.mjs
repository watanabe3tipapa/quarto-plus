import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import * as cheerio from "cheerio";
import { globFiles } from "./lib/glob.mjs";
import {
  ADOC_GLOB,
  ADOC_DIR,
  ADOC_HTML_DIR,
  ADOC_FRAG_DIR,
  ADOC_QMD_DIR,
  THEMES_DIR,
} from "./config.mjs";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", (err) => reject(err));
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function extractFragmentAndWrap(adocPath) {
  const rel = path.relative(ADOC_DIR, adocPath).replace(/\.adoc$/, "");

  const srcHtml = path.join(ADOC_HTML_DIR, rel + ".html");
  const fragHtml = path.join(ADOC_FRAG_DIR, rel + ".html");
  const qmd = path.join(ADOC_QMD_DIR, rel + ".qmd");

  const html = await fs.readFile(srcHtml, "utf8");
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || $("title").first().text().trim();

  const content = $("#content").first();
  let fragment = "";
  if (content.length) {
    fragment = content.html();
  } else {
    const body = $("body").first();
    fragment = body.html() ?? "";
  }

  await fs.mkdir(path.dirname(fragHtml), { recursive: true });
  await fs.writeFile(fragHtml, fragment);

  const fragRelFromQmd = path.relative(path.dirname(qmd), fragHtml);
  const cssRelFromQmd = path.relative(path.dirname(qmd), path.join(THEMES_DIR, "adoc.css"));

  const qmdContent = `---
title: "${(title || rel).replaceAll('"', '\\"')}"
format:
  html:
    css: ${cssRelFromQmd}
---

{{< include ${fragRelFromQmd} >}}
`;

  await fs.mkdir(path.dirname(qmd), { recursive: true });
  await fs.writeFile(qmd, qmdContent);
}

async function main() {
  const files = await globFiles(ADOC_GLOB);

  for (const adocPath of files) {
    const rel = path.relative(ADOC_DIR, adocPath).replace(/\.adoc$/, "");
    const outHtmlPath = path.join(ADOC_HTML_DIR, rel + ".html");

    await fs.mkdir(path.dirname(outHtmlPath), { recursive: true });

    await run("asciidoctor", ["-b", "html5", "-o", outHtmlPath, adocPath]);
    await extractFragmentAndWrap(adocPath);
  }

  const resources = await globFiles(path.join(ADOC_DIR, "**/*"), {
    exclude: [".adoc"],
  });
  let copiedResources = 0;
  for (const srcAbs of resources) {
    const rel = path.relative(ADOC_DIR, srcAbs);
    const destAbs = path.join(ADOC_QMD_DIR, rel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.copyFile(srcAbs, destAbs);
    copiedResources++;
  }

  console.log(
    `adoc -> quarto: ${files.length} pages, ${copiedResources} resources -> ${ADOC_QMD_DIR}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
