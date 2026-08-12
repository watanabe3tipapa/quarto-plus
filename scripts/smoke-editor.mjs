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
console.log("console errors:", errors.length ? errors : "(none)");
