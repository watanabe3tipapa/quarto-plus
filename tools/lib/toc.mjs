import { escapeHtml } from "./slug.mjs";

function buildTree(items) {
  const root = { depth: -1, children: [] };
  const stack = [root];

  for (const it of items) {
    const depth = it.level - 2;
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const node = { depth, item: it, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}

function serialize(nodes) {
  if (nodes.length === 0) return "";
  let out = "<ul class=\"toc\">";
  for (const n of nodes) {
    const id = n.item.finalId;
    const text = escapeHtml(n.item.text);
    out += `<li><a href="#${id}">${text}</a>${serialize(n.children)}</li>`;
  }
  return out + "</ul>";
}

export function renderTocNested(headings) {
  const hs = headings.filter((h) => /^h[2-6]$/.test(h.tag));
  if (hs.length === 0) return "";
  const root = buildTree(hs);
  return serialize(root.children);
}
