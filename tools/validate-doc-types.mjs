import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./config.mjs";

const REGISTRY = JSON.parse(
  await fs.readFile(path.join(ROOT, "tools/doc-types.json"), "utf8")
);

function stripCodeFences(content) {
  return content
    .split(/\n```[^\n]*\n/)
    .filter((s, i) => i % 2 === 0)
    .join("\n");
}

async function collectHeadings(fileAbs) {
  const content = stripCodeFences(await fs.readFile(fileAbs, "utf8"));
  const headings = [];
  const isAdoc = fileAbs.endsWith(".adoc");
  for (const line of content.split("\n")) {
    const m = isAdoc
      ? line.match(/^={2,6}\s+(.+)/)
      : line.match(/^#{2,6}\s+(.+)/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

async function main() {
  const templates = REGISTRY.templates || {};
  const types = REGISTRY.types || {};
  let errors = 0;
  let checked = 0;
  let missing = [];

  for (const [rel, type] of Object.entries(templates)) {
    const required = types[type]?.headings || [];
    if (!required.length) continue;
    const fileAbs = path.join(ROOT, rel);
    let headings;
    try {
      headings = await collectHeadings(fileAbs);
    } catch {
      errors++;
      missing.push(`${rel} (${type}): file not found`);
      continue;
    }
    checked++;
    for (const req of required) {
      if (!headings.some((h) => h.includes(req))) {
        errors++;
        missing.push(`${rel} (${type}): heading "${req}" not found`);
      }
    }
  }

  if (errors > 0) {
    for (const m of missing) console.log(`[doc-type] ${m}`);
    console.log(`validate-doc-types: ${errors} error(s)`);
    process.exit(1);
  }
  console.log(
    `validate-doc-types: OK (${checked} templates checked against doc-types.json)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});