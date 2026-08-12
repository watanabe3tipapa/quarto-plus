import React, { useCallback, useEffect, useRef, useState } from "react";
import { $getRoot, $getSelection, $isRangeSelection, ParagraphNode, UNDO_COMMAND, REDO_COMMAND } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListItemNode, ListNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from "@lexical/list";
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { LinkNode, AutoLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { $setBlocksType } from "@lexical/selection";
import { $isLinkNode } from "@lexical/link";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $generateHtmlFromNodes } from "@lexical/html";

import "./editor.css";

const STORAGE_KEY = "qp-editor-state";

function getInitialState() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const URL_MATCHER = /((https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)))/;

function ToolbarButton({ label, title, active, onMouseDown, disabled }) {
  return (
    <button
      type="button"
      className={`toolbar-btn${active ? " active" : ""}`}
      title={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function ToolbarPlugin({ onStatsChange }) {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, strike: false, code: false, link: false, h2: false, h3: false, bullet: false, number: false, check: false, quote: false });

  const updateToolbar = useCallback(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return;
    const node = sel.anchor.getNode();
    const ancestor = node.getTopLevelElement();
    const next = {
      bold: sel.hasFormat("bold"),
      italic: sel.hasFormat("italic"),
      underline: sel.hasFormat("underline"),
      strike: sel.hasFormat("strikethrough"),
      code: sel.hasFormat("code"),
      link: $isLinkNode(sel.getNodes()[0]) || node.isAttached() && (node.getParents().some((n) => $isLinkNode(n)) || $isLinkNode(node)),
      h2: ancestor instanceof HeadingNode && ancestor.getTag() === "h2",
      h3: ancestor instanceof HeadingNode && ancestor.getTag() === "h3",
      bullet: ancestor instanceof ListNode && ancestor.getListType() === "bullet",
      number: ancestor instanceof ListNode && ancestor.getListType() === "number",
      check: ancestor instanceof ListNode && ancestor.getListType() === "check",
      quote: ancestor instanceof QuoteNode,
    };
    setActive(next);
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        updateToolbar();
        const root = $getRoot();
        const text = root.getTextContent();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        onStatsChange({ words, chars: text.length });
      });
    });
  }, [editor, updateToolbar, onStatsChange]);

  const formatBlock = (creator) => {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, creator);
    });
  };

  const toggleFormat = (type) => {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) sel.toggleFormat(type);
    });
  };

  const toggleLink = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
  };

  const toggleList = (listType) => {
    const cmd =
      listType === "bullet"
        ? INSERT_UNORDERED_LIST_COMMAND
        : listType === "number"
        ? INSERT_ORDERED_LIST_COMMAND
        : INSERT_CHECK_LIST_COMMAND;
    editor.dispatchCommand(cmd);
  };

  const undo = () => editor.dispatchCommand(UNDO_COMMAND);
  const redo = () => editor.dispatchCommand(REDO_COMMAND);

  return (
    <div className="toolbar">
      <ToolbarButton label="↺" title="取り消し" onMouseDown={undo} />
      <ToolbarButton label="↻" title="やり直し" onMouseDown={redo} />
      <span className="toolbar-sep" />
      <ToolbarButton label={<b>B</b>} title="太字" active={active.bold} onMouseDown={() => toggleFormat("bold")} />
      <ToolbarButton label={<i>I</i>} title="斜体" active={active.italic} onMouseDown={() => toggleFormat("italic")} />
      <ToolbarButton label={<u>U</u>} title="下線" active={active.underline} onMouseDown={() => toggleFormat("underline")} />
      <ToolbarButton label={<s>S</s>} title="取り消し線" active={active.strike} onMouseDown={() => toggleFormat("strikethrough")} />
      <ToolbarButton label="</>" title="コード" active={active.code} onMouseDown={() => toggleFormat("code")} />
      <span className="toolbar-sep" />
      <ToolbarButton label="H2" title="見出し2" active={active.h2} onMouseDown={() => formatBlock(() => $createHeadingNode("h2"))} />
      <ToolbarButton label="H3" title="見出し3" active={active.h3} onMouseDown={() => formatBlock(() => $createHeadingNode("h3"))} />
      <ToolbarButton label="¶" title="段落" onMouseDown={() => formatBlock(() => new ParagraphNode())} />
      <ToolbarButton label="❝" title="引用" active={active.quote} onMouseDown={() => formatBlock(() => $createQuoteNode())} />
      <span className="toolbar-sep" />
      <ToolbarButton label="•" title="箇条書き" active={active.bullet} onMouseDown={() => toggleList("bullet")} />
      <ToolbarButton label="1." title="番号付き" active={active.number} onMouseDown={() => toggleList("number")} />
      <ToolbarButton label="☑" title="チェックリスト" active={active.check} onMouseDown={() => toggleList("check")} />
      <ToolbarButton label="🔗" title="リンク" active={active.link} onMouseDown={toggleLink} />
    </div>
  );
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ActionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const fileRef = useRef(null);

  const exportMarkdown = () => {
    const md = editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS));
    download("editor.md", md, "text/markdown");
  };
  const exportHtml = () => {
    const html = editor.getEditorState().read(() => $generateHtmlFromNodes(editor));
    download("editor.html", html, "text/html");
  };
  const exportJson = () => {
    const json = JSON.stringify(editor.getEditorState().toJSON(), null, 2);
    download("editor.json", json, "application/json");
  };
  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        editor.setEditorState(editor.parseEditorState(reader.result));
      } catch (e) {
        console.error(e);
        alert("JSON の読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="ed-actions">
      <button type="button" className="ed-action" onClick={exportMarkdown}>MD 出力</button>
      <button type="button" className="ed-action" onClick={exportHtml}>HTML 出力</button>
      <button type="button" className="ed-action" onClick={exportJson}>JSON 出力</button>
      <button type="button" className="ed-action" onClick={() => fileRef.current && fileRef.current.click()}>JSON 読込</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) importJson(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function InitialContentPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const saved = getInitialState();
    if (saved) {
      editor.setEditorState(editor.parseEditorState(saved));
    }
  }, [editor]);
  return null;
}

function SavePlugin() {
  const [editor] = useLexicalComposerContext();
  const handleChange = useCallback(
    (editorState) => {
      const serialized = JSON.stringify(editorState.toJSON());
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch {}
    },
    []
  );
  return <OnChangePlugin onChange={handleChange} />;
}

const theme = {
  paragraph: "ed-paragraph",
  heading: { h2: "ed-heading ed-h2", h3: "ed-heading ed-h3" },
  list: { listitem: "ed-listitem", nested: { listitem: "ed-listitem" } },
  quote: "ed-quote",
  text: { bold: "ed-bold", italic: "ed-italic", underline: "ed-underline", strikethrough: "ed-strike", code: "ed-code" },
  link: "ed-link",
  code: "ed-codeblock",
};

function App() {
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const initialConfig = {
    namespace: "qp-editor",
    theme,
    onError: (error) => console.error(error),
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, CodeNode, CodeHighlightNode],
  };

  return (
    <div className="ed-card">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="ed-toolbar">
          <ToolbarPlugin onStatsChange={setStats} />
        </div>
        <InitialContentPlugin />
        <SavePlugin />
        <HistoryPlugin />
        <div className="ed-body">
          <RichTextPlugin
            contentEditable={<ContentEditable className="ed-content" ariaLabel="エディタ" />}
            placeholder={<div className="ed-placeholder">ここに入力してください…</div>}
          />
        </div>
        <ListPlugin />
        <LinkPlugin />
        <CheckListPlugin />
        <AutoLinkPlugin matchers={[(text) => { const m = URL_MATCHER.exec(text); if (m === null) return null; return { index: m.index, length: m[0].length, text: m[0], url: m[0] }; }]} />
        <ActionsPlugin />
      </LexicalComposer>
      <div className="ed-status">
        {stats.words} words · {stats.chars} chars（自動保存）
      </div>
    </div>
  );
}

export default App;
