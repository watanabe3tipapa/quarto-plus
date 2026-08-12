import path from "node:path";
import fsp from "node:fs/promises";

export async function globFiles(pattern, options = {}) {
  const { cwd, exclude = [] } = options;
  const out = [];
  for await (const e of fsp.glob(pattern, { cwd, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const p = path.join(e.parentPath, e.name);
    if (exclude.some((suffix) => p.endsWith(suffix))) continue;
    out.push(p);
  }
  return out.sort();
}
