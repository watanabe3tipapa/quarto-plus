import { JSDOM } from "jsdom";
import fs from "node:fs";

const html = fs.readFileSync("dist/index.html", "utf8");
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "outside-only",
  url: "https://watanabe3tipapa.github.io/quarto-plus/",
  pretendToBeVisual: true,
});
const win = dom.window;
win.console.error = (...a) => errors.push(a.join(" "));

globalThis.window = win;
globalThis.document = win.document;
globalThis.localStorage = win.localStorage;
win.addEventListener("error", (e) => errors.push("window.error: " + (e.error && e.error.message || e.message)));

const code = fs.readFileSync(process.env.EDITOR_BUNDLE || "dist/editor/editor.js", "utf8");
await win.eval(code);

await new Promise((r) => setTimeout(r, 1200));

const mounted = win.document.querySelector("#qp-editor-root");
const contentEditable = win.document.querySelector("[contenteditable='true']");
console.log("mount root found:", !!mounted);
console.log("contentEditable found:", !!contentEditable);
console.log("toolbar buttons:", win.document.querySelectorAll(".toolbar-btn").length);

for (const label of ["H2", "H3", "•", "1.", "☑", "❝", "B", "↺", "↻"]) {
  const btn = [...win.document.querySelectorAll(".toolbar-btn")].find(
    (b) => b.title === label || b.textContent.trim() === label
  );
  if (btn) btn.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
}
await new Promise((r) => setTimeout(r, 200));

const downloads = [];
win.URL.createObjectURL = (blob) => {
  downloads.push({ name: "", blob });
  return "blob:mock";
};
win.URL.revokeObjectURL = () => {};
const realAppend = win.document.body.appendChild.bind(win.document.body);
win.document.body.appendChild = (node) => {
  if (node && node.download) downloads[downloads.length - 1].name = node.download;
  return realAppend(node);
};
win.HTMLAnchorElement.prototype.click = function () {};

for (const label of ["MD 出力", "HTML 出力", "JSON 出力"]) {
  const btn = [...win.document.querySelectorAll(".ed-action")].find((b) => b.textContent.trim() === label);
  if (btn) btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
}
await new Promise((r) => setTimeout(r, 100));

console.log("action buttons:", win.document.querySelectorAll(".ed-action").length);
console.log("downloads:", downloads.map((d) => d.name).join(", ") || "(none)");
if (downloads.length) {
  for (const d of downloads) {
    const text = await d.blob.text();
    console.log(`  ${d.name}: ${text.length} bytes, starts "${text.slice(0, 30).replace(/\n/g, "\\n")}"`);
  }
}
console.log("console errors:", errors.length ? errors : "(none)");

const jsonState = JSON.stringify({
  root: { type: "root", version: 1, children: [
    { type: "heading", tag: "h2", version: 1, children: [{ type: "text", detail: 0, format: 0, mode: "normal", style: "", text: "見出しテスト", version: 1 }], direction: "ltr", format: "", indent: 0 },
    { type: "paragraph", version: 1, children: [{ type: "text", detail: 0, format: 1, mode: "normal", style: "", text: "太字の段落", version: 1 }], direction: "ltr", format: "", indent: 0 },
    { type: "paragraph", version: 1, children: [{ type: "text", detail: 0, format: 0, mode: "normal", style: "", text: "Hello world", version: 1 }], direction: "ltr", format: "", indent: 0 },
  ], direction: "ltr", format: "", indent: 0 },
});
const fileInput = win.document.querySelector(".ed-actions input[type=file]");
const file = new win.File([jsonState], "editor.json", { type: "application/json" });
Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
fileInput.dispatchEvent(new win.Event("change", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));

downloads.length = 0;
for (const label of ["MD 出力"]) {
  const btn = [...win.document.querySelectorAll(".ed-action")].find((b) => b.textContent.trim() === label);
  if (btn) btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
}
await new Promise((r) => setTimeout(r, 100));
const mdText = downloads.length ? await downloads[0].blob.text() : "";
console.log("import->markdown export:", JSON.stringify(mdText));
console.log("final console errors:", errors.length ? errors : "(none)");

dom.window.close();
process.exit(0);
