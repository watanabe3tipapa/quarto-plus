import path from "node:path";

export function makePagePrefix(siteRelHtmlPath) {
  const rel = siteRelHtmlPath.replace(/\.html$/, "");
  return rel.replaceAll("/", "-").replace(/^-+|-+$/g, "");
}

export function collectHeadings($) {
  const headings = [];
  $("h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const level = Number(tag.substring(1));
    const text = ($(el).text() || "").trim();
    const oldId =
      $(el).attr("id") ?? $(el).attr("data-anchor-id") ?? null;
    headings.push({ el, tag, level, text, oldId, finalId: null });
  });
  return headings;
}

export function computeFinalIds(headings, pagePrefix, dict = {}) {
  const slugCounts = new Map();
  const idMap = new Map();
  const textMap = new Map();
  const finalIds = new Set();

  for (const h of headings) {
    const base = romanize(h.text, dict);
    const count = (slugCounts.get(base) || 0) + 1;
    slugCounts.set(base, count);
    const suffix = count === 1 ? "" : `-${count}`;
    let finalId = `${pagePrefix}-${base}${suffix}`;

    let n = 1;
    while (finalIds.has(finalId)) {
      n++;
      finalId = `${pagePrefix}-${base}-${n}`;
    }
    finalIds.add(finalId);

    h.finalId = finalId;
    if (h.oldId) idMap.set(h.oldId, finalId);
    if (!textMap.has(h.text)) textMap.set(h.text, finalId);
  }

  return { idMap, textMap };
}

import { romanizeSlug } from "./slug.mjs";
function romanize(text, dict) {
  return romanizeSlug(text, dict);
}

export function toSiteRel(absPath, siteRoot) {
  const rel = path.relative(siteRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

export function resolveHrefToSiteRel(currentAbsHtml, siteRoot, href, baseUrl = "") {
  const withoutHash = href.split("#")[0];
  if (!withoutHash) return null;
  if (/^(https?:)?\/\//i.test(withoutHash) || withoutHash.startsWith("data:")) {
    return null;
  }

  let abs;
  if (baseUrl && withoutHash.startsWith(`${baseUrl}/`)) {
    abs = path.join(siteRoot, withoutHash.slice(baseUrl.length + 1));
  } else {
    abs = path.resolve(path.dirname(currentAbsHtml), withoutHash);
  }

  const rel = path.relative(siteRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}
