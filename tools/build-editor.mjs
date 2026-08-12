import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs/promises";
import { ROOT } from "./config.mjs";

const SRC = path.join(ROOT, "editor/src");
const OUT = path.join(ROOT, "build/editor");

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  await build({
    entryPoints: [path.join(SRC, "index.jsx")],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "iife",
    target: ["es2020"],
    outdir: OUT,
    outbase: SRC,
    logLevel: "silent",
  });

  const jsStat = await fs.stat(path.join(OUT, "index.js"));
  let cssSize = 0;
  try {
    cssSize = (await fs.stat(path.join(OUT, "index.css"))).size;
  } catch {}

  console.log(
    `build-editor: editor.js (${jsStat.size} bytes)` +
      (cssSize ? ` + editor.css (${cssSize} bytes)` : "") +
      ` -> ${OUT}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
