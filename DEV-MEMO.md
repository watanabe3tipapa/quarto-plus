# DEV-MEMO

このドキュメントは実装の設計意図・決定事項・進捗を作業フェーズごとに追録するメモです。
追録は各フェーズの完了時に追記する。

---

## Phase 0: 実装プラン確定（2026-08-12）

### 目的
`.md / .qmd / .adoc / HTML` を横断する「quarto-plus」フレーバーのドキュメントツール。
quarto を中心に、全入力形式を最終的に単一の静的HTMLサイト（`dist/`）へ統合する。

### 確定済みの仕様（PLAN.md より継承）
- `.md / .qmd` は **quarto render** で最終HTML生成
- `.adoc` は **asciidoctor** でHTML化 → `build/site` にマージ（上書き優先: adoc > quarto）
- 見出しIDは `pagePrefix-<romanize_slug(見出し全文)>`、ページ内衝突は `-2, -3...`
- 未対応文字（漢字・記号）は `_` にフォールバック
- 日本語見出しは英語化slug（完全辞書 + 簡易ローマ字、運用で辞書拡張）
- TOCは `h2..h6` から入れ子生成（h2=最上位）、リンクは `href="#<finalId>"`
- アセットは内容ハッシュ `sha256-<basename>` で `assets/` に集約、`img[src]` のみ（CSS url() は後回し）
- 検証はフラグメントリンク（同一＋クロスページ）の切れ検出
- 最終成果物は `dist/`（毎回 clean して再配置）

### PLAN.md からの訂正
1. **quarto project root はリポジトリ直下**。`quarto/_quarto.yml` + `input/docs` は quarto が render しないため不成立。
2. **クロスページアンカー対策**。harmonize は 2 パス方式（Pass1 で全ページ idmap 収集 → Pass2 で同一＋クロスページ `*.html#frag` を rewrite）。
3. **アセット参照は BASEURL 相対**で解決（深い階層ページで `assets/` 相対が壊れる問題の回避）。
4. **TOCは設定可変**（`--toc-mode auto|force-own|replace-container`）。初期の quarto 実DOM確認後に確定する。

### 実装構造
```
quarto-plus/
  _quarto.yml            # project: website, output-dir: build/site
  .gitignore             # node_modules/, build/, dist/
  package.json           # type:module, deps: cheerio/glob, scripts
  docs/                  # .md / .qmd（quartoが直接render）
  adoc/                  # .adoc（asciidoctor→HTML→マージ）
  _templates/            # ヘッダ/フッタ, #toc コンテナ
  themes/
  tools/
    lib/slug.mjs         # romanize_slug, escapeHtml（辞書対応）
    lib/toc.mjs          # stack-based 入れ子TOC生成
    lib/idmap.mjs        # oldId→finalId マップ, pagePrefix算出, dedupe
    adoc-to-html.mjs     # asciidoctor → build/adoc-html
    merge-adoc.mjs       # build/adoc-html → build/site（上書き優先）
    harmonize.mjs        # 2パス: idmap収集 → 同一/クロスrewrite＋TOC
    asset-sync.mjs       # img src 内容hashで assets/ へ、BASEURL相対書換
    validate.mjs         # 同一＋クロスページ フラグメント解決検証
    copy-dist.mjs        # clean dist → site-harmonized から再配置
```

### ビルドパイプライン（npm run build:all）
```
adoc→html → clean build/site → quarto render → merge adoc(上書き優先)
→ harmonize(Pass1→Pass2, TOC) → asset-sync → validate → clean dist → copy dist
```

### 残課題（要検討）
- point 3（quarto自前ID/TOCとの関係）: `--toc-mode` で可変にし、サンプルrenderの実DOM観察後に確定
- asciidoctor の stand-alone HTML はサイトテーマを継承しない（Phase 1 は素のまま、Phase 2 で body抽出+テンプレ注入）

---

## Phase 1: scaffold（2026-08-12）

作成ファイル:
- `package.json`（type: module, deps: cheerio@1, glob@10, scripts: build:all ほか）
- `_quarto.yml`（project type: website, output-dir: build/site, render: docs/）
- `.gitignore`（node_modules/, build/, dist/）
- `docs/`（index.qmd, guide.md, images/sample.png）
- `adoc/`（adoc-sample.adoc, images/adoc-sample.png）
- `tools/config.mjs`（パス・BASEURL・TOCモード・辞書ロード）
- `tools/dict.json`（空のカスタム辞書。運用で追加）
- `tools/lib/slug.mjs`（romanize_slug: かな→ローマ字テーブル, 未対応は `_`, 空は `section`）
- `tools/lib/toc.mjs`（ツリー構築による正しい入れ子TOC生成）
- `tools/lib/idmap.mjs`（pagePrefix, collectHeadings, computeFinalIds, パス解決）

注意点:
- **quarto の project root はリポジトリ直下**。`quarto/_quarto.yml` + `input/docs` 分割は quarto が render しないため不成立（PLAN.md からの訂正1）。
- `_quarto.yml` に `render: - docs/` を指定しないと PLAN.md / DEV-MEMO.md まで render されてしまう。

---

## Phase 2: サンプルrender → 実DOM観察（2026-08-12）

quarto 1.3.450 の website 出力の実状:
- **見出しに `id` 属性が無く、`class="anchored"` + `data-anchor-id="<日本語原文>"` が付く**
  - AnchorJS(anchor.min.js) がクライアント側で `data-anchor-id` を元にpermalinkを生成
  - quarto.js のスクロール追従も `[data-anchor-id=...]` セレクタを使う
- 同一ページ内リンクは `href="#日本語の見出し"`、クロスページは `href="index.html#機能"` の形式
- website デフォルトテーマでは **`#toc` コンテナは存在しない**（toc無効のため）
- ルートの `index.html` は `docs/index.html` へのリダイレクトスタブ

### 確定した実装方針
- harmonize は見出しに `id` と `data-anchor-id` の**両方**を `finalId` で設定（AnchorJS/スクロール追従が壊れないように）
- 旧アンカーID（data-anchor-id）も oldId として idMap に入れ、ページ内/クロスページリンクを置換
- `render: - docs/` で render 対象を docs のみに限定

---

## Phase 3: harmonize 実装（2パス方式）（2026-08-12）

`tools/harmonize.mjs`:
- Pass1: `build/site/**/*.html` を全解析 → ページごとに `{ pagePrefix, meta:[{oldId,finalId,text,level,tag}], idMap }` を収集
- Pass2: 各ページを再解析し
  1. 見出し h2..h6 の `id` / `data-anchor-id` を finalId に書換
  2. 同一ページ `href="#oldId"` → `#finalId`
  3. クロスページ `href="xxx.html#oldId"` → `xxx.html#finalId`（対象ページの idMap から解決、BASEURL 非依存の相対解決）
  4. TOC: `--toc-mode`（auto / replace-container / force-own）に従い、既存 `#toc` 候補の innerHTML を置換 or 新規作成（`main.prepend`、無ければ `body.prepend`）
- 見出しが無いページ（リダイレクトスタブ等）はそのままコピー
- 非HTMLアセットは build/site → build/site-harmonized へミラー（asset-sync の解決元を確保）

実装時に踏んだ罠:
- Pass1 で保持した `el` 参照は Pass2 の別 cheerio DOM に属し書換が効かない → **Pass2 で再収集し index で zip**
- TOCの文字列連結入れ子は不正HTMLになりがち → **ツリー構築 + 再帰シリアライズ**に変更（li 内に ul を正しくネスト）

---

## Phase 4: adoc 合流・資産集約・検証・配布（2026-08-12）

- `tools/adoc-to-html.mjs`: asciidoctor `-b html5` で `.adoc → build/adoc-html/<rel>.html`。**非 .adoc リソース（images等）も build/adoc-html へ同構造コピー**
- `tools/merge-adoc.mjs`: build/adoc-html → build/site へ**全ファイル**コピー（adoc > quarto 上書き優先）
  - ※当初 .html のみコピーしていたため adoc 画像が欠落 → 全ファイルに修正
- `tools/asset-sync.mjs`: harmonized 内の `img[src]` を走査
  - data/http(s) はスキップ、相対/`BASEURL/` 絶対を解決
  - 実体を sha256 ハッシュ名 `assets/<sha>-<basename>` へコピー（重複コピー回避）
  - `src` を**ページの深さに応じた相対パス**（例 `../assets/...`, `assets/...`）へ書換
- `tools/validate.mjs`: 同一ページID衝突 + フラグメントリンク切れ + クロスページフラグメント解決を検証（失敗時 exit 1）
  - `.each` コールバック内 `await` は SyntaxError → リンクを先に収集して非同期ループ化
- `tools/copy-dist.mjs`: build/site-harmonized → dist/（dist は毎回 clean）

---

## Phase 5: 通しビルド検証（2026-08-12）

`npm run build:all` がエラー0で完走:
```
adoc -> html: 1 pages, 1 resources
quarto render -> docs/index.html, docs/guide.html
merge: 2 adoc files (overwrite)
harmonize: mirrored 21 assets, 3 pages (toc-mode=auto)
asset-sync: updated 2 html files
validate: OK (4 pages, no broken anchors)
copy-dist: 27 files -> dist/
```

dist 検証:
- 全ページ（docs/index, docs/guide, adoc-sample）に `#toc` 入れ子目次
- 画像は `assets/<sha>-<name>` に集約され、深さ相対で参照
- クロスページリンク `guide.html#docs-guide-no_shi` 等が正しく書換
- 見出しは `id` + `data-anchor-id` とも finalId（AnchorJS/スクロール追従と整合）

### 既知の制約（残課題）
- **quarto の検索(search.json)は harmonize 前のアンカーIDで生成**されるため、サイト内検索のリンク先が旧IDで切れる可能性（priority B のためPhase 1では許容。将来は harmonized 後から search.json を再生成する）
- adoc ページは asciidoctor の stand-alone 出力のまま（サイトテーマ/ナビ未継承）。Phase 2 で body抽出＋quartoテンプレ注入を検討
- 集約前の元画像ディレクトリ（`images/`）は dist に残る（参照は assets へ向いているため無害。不要なら asset-sync 後に削除する処理を追加可）
- `dist/` 内に `robots.txt / sitemap.xml / search.json` が quarto 生成のままコピーされる（BASEURL が未設定のためリンクは相対のまま）

---

## Phase 6: GitHub Pages 公開 + LP / チュートリアル / デモサイト（2026-08-12）

### GitHub Pages
- `.github/workflows/pages.yml` を作成
  - `push` to `main` / `workflow_dispatch` で実行
  - Ruby(asciidoctor) + Node 22 + Quarto setup → `npm run build:all` → `dist/` を `actions/deploy-pages` でデプロイ
  - リポジトリ設定: **Settings → Pages → Source: GitHub Actions** を選択する必要あり
- 相対リンク主体のためプロジェクトページ（`/repo/` 配下）でもそのまま動作。`_quarto.yml` の `site-url` を本番URLに更新すること

### LP（ランディングページ）
- `index.qmd`（ルート）: ヒーロー + 機能カード + パイプライン図 + CTA。`themes/lp.css` を per-document css で適用
- `_quarto.yml` の `render:` に `index.qmd` を追加（ルート index.html がリダイレクトスタブから実ページへ）

### チュートリアル
- `docs/tutorial.qmd`: 前提条件 → 構成 → 文書追加 → ビルド → 確認 → GitHub Pages公開 → 仕様、の流れ

### デモサイト
- `demo/index.qmd` / `demo/markdown-demo.md` + `adoc/demo/asciidoc-demo.adoc`
  - **デモの adoc は `adoc/` 配下に置く**（adoc-to-html の取り込み元が `adoc/` のため。demo/直下だと処理されない）
  - 画像 `demo/images/*.png`（quarto経由）、`adoc/demo/images/*.png`（asciidoctor参照・リソースコピー経由）
- ナビゲーション: Home / Tutorial / Docs / Demo

### 実装改善（リンク解決のフォールバック強化）
- asciidoctor の `<<まとめ>>` xref は `href="#まとめ"` を生成するが、見出し id は `_まとめ`（`_`プレフィックス付き）で不整合 → **validate が検出**
- 対策: `computeFinalIds` が `textMap`（見出しテキスト→finalId）も返すようにし、harmonize の fragment 解決を
  1. idMap（oldId→finalId）
  2. textMap（見出しテキスト完全一致）
  3. asciidoctor の `_` プレフィックス有無を試す
  の順でフォールバックするよう強化。クロスページも同じ解決ロジックを適用

### 検証
- `npm run build:all` 成功（8ページ）
- dist 内: 全ページに `#toc`、画像は `assets/<sha>-<name>` に集約・深さ相対参照、クロスページアンカー解決済み
- LPの `themes/lp.css` が dist にコピーされリンクされていることを確認

---

## Phase 7: DOM構造の解説トピック（2026-08-12）

### 追加ページ
- `docs/dom-structure.qmd`「DOM構造の解説」を作成
  - **mermaid 図解を7点**含む: 全体パイプライン / ページ全体構造 / 見出しID規約 / #toc入れ子構造 / リンク解決フォールバック / クロスページ解決 / 画像参照統一
  - 実HTMLの構造例（`id`/`data-anchor-id`、`#toc`骨格、画像の深さ相対参照）も併記
  - 末尾に「実物を確認する」でデモサイトへの導線
- `docs/index.qmd` をトピックインデックス化（DOM構造解説 + クイックスタート）

### 検証
- `npm run build:all` 成功（9ページ）
- quarto 1.3 は mermaid を `<pre class="mermaid mermaid-js">` + `site_libs/quarto-diagram/` で出力
  - harmonize のアセットミラーにより quarto-diagram の js/css が dist にコピーされることを確認
  - `#toc` は h2..h6（8見出し）から正しく生成

---

## Phase 8: 全体再検証（2026-08-12）

### 発見・修正した問題

**[P1] stale 成果物バグ**
- 削除した .md/.qmd/.adoc が dist に残り続けた（build/adoc-html と build/site-harmonized がクリーンされないため）
- → `clean:adoc` / `clean:harmonized` を build:all に追加し解消

**[P1] search.json が harmonize 後と不整合**
- quarto 生成の search.json は旧アンカーIDを参照（`#日本語の見出し` 等）→ 検索リンクがダングリング。adoc ページは元々検索対象外
- → `tools/rebuild-search.mjs` を新設。harmonize 済み HTML から quarto 互換スキーマ（objectID/href/title/section/text）の search.json を再生成（67エントリ、adoc 含む）

**[P2] validate の検知漏れ**
- フラグメントなしのページリンク切れ・画像参照切れを検出しなかった
- → `[missing-file]` チェックを追加（.html / 画像 / css/js 等）、サイト外へのパス解決は無視

**[P2] glob@10.5.0 が非推奨（セキュリティ警告）**
- → Node 22 標準 `fs.promises.glob` へ移行（`tools/lib/glob.mjs`）。依存から glob を除去（0 vulnerabilities）

**[P2] asset-sync の冪等性バグ**
- すでに `assets/<sha>-<name>` 化された src を再度ハッシュ化し `<sha>-<sha>-<name>` を毎回生成
- → assets 内のソースは変更対象外に（再実行で 0 updated に収束）

**[P2] パストラバーサル / BASEURL 未対応**
- `resolveHrefToSiteRel` がサイト外へ解決しうる / `BASEURL/` 絶対パスのクロスページアンカーを解決できない
- → サイト外解決は null に、`BASEURL` プレフィックス対応を追加（harmonize/validate 共通）

**[P3] CI ワークフロー**
- `npm ci || npm install` が失敗を隠す → `npm ci` に修正

### 未対応（設計・設定項目として残す）

1. **`_quarto.yml` の `site-url` が `https://example.com/`** — sitemap.xml/canonical が誤ドメイン。本番URLへの設定が必要
2. **adoc ページは stand-alone のまま**（navbar なし・asciidoctor 埋め込み style 約29KB/ページ・テーマ非一致）— Phase 2 で body抽出＋quarto テンプレ注入を検討
3. **LP のレイアウト** — harmonize が `#toc` をヒーロー/タイトルより上に注入する。`toc: false` のページは #toc を挿入しない選択肢を検討
4. **`srcset` / `<picture>` / video poster / CSS `url()`** は集約対象外（計画通り、Phase 3）
5. **dist に元画像ディレクトリ（images/）が残る**（assets/ へ集約後も未使用で残存。無害）
6. **`dist/.nojekyll` 未生成**（Actions デプロイでは不要だが、念のため追加を推奨）
7. **git 未初期化** — GitHub Pages に push する前に `git init` + remote 設定が必要
8. **rebuild-search の adoc ページ intro が空**（main 要素が無いため。ページタイトルは <title> から取得）

---

## Phase 9: 残課題の再検証と解消（2026-08-12）

### 背景
Phase 8 以降、adoc 統合が **qmd ラップ方式**（`adoc-to-html.mjs` が asciidoctor の `#content` を抽出し `build/adoc-qmd/**/*.qmd` を生成 → quarto が render）に刷新されたが、DEV-MEMO に未反映だった。これを踏まえて Phase 8 の「未対応」リストを再検証した。

### 状態の変化（再検証結果）
| 未対応項目 | 結果 |
|---|---|
| #1 site-url が example.com | **解消** — 本番URL `https://watanabe3tipapa.github.io/quarto-plus/` に設定 |
| #2 adoc ページ stand-alone | **解消** — qmd ラップにより quarto の navbar/theme(`adoc.css`)/`<main>` を継承 |
| #3 LP の #toc 注入 | **解消** — `TOC_EXCLUDE_PREFIXES`（既定 `index`）を追加。`auto` モードで除外ページは既存 TOC のみ置換・新規作成しない |
| #4 srcset/picture/CSS url() 未集約 | 据え置き（Phase 3 計画通り） |
| #5 dist の images/ 残存 | **解消** — `copy-dist.mjs` で `images/` 配下パスをコピー対象から除外（site_libs に images/ は無く安全） |
| #6 dist/.nojekyll 未生成 | **解消** — `copy-dist.mjs` で空 `.nojekyll` を生成 |
| #7 git 未初期化 | **解消** — リポジトリ `watanabe3tipapa/quarto-plus` に初期化・push |
| #8 rebuild-search の adoc intro 空 | **解消** — qmd 経由で `<main>` が付き intro が非空 |

### adoc 刷新に伴うデモリンク修正（validate で検出）
qmd ラップ方式により adoc デモの出力先が `demo/asciidoc-demo.html` → `build/adoc-qmd/demo/asciidoc-demo.html` へ変わったため、旧パスを参照していたリンクを実出力へ修正:
- `demo/index.qmd`: AsciiDoc デモへの2箇所の参照を `../build/adoc-qmd/demo/asciidoc-demo.html` へ（フラグメントは `build-adoc-qmd-demo-asciidoc-demo-matome`）
- `docs/dom-structure.qmd`: `../build/adoc-qmd/demo/asciidoc-demo.html` へ
- `adoc/demo/asciidoc-demo.adoc`: `link:../../../demo/markdown-demo.html` へ（`build/adoc-qmd/demo/` からの深さ相対）

### その他の変更
- `package.json` の `clean:adoc` を `build/adoc-html build/adoc-frag build/adoc-qmd` の3ディレクトリ対象へ拡張（Phase 8 P1 stale バグと同種の残留を防ぐ）

### 検証
- `npm run build:all` 成功、`validate: OK (9 pages, no broken anchors)`
- dist: `.nojekyll` 生成・`images/` ディレクトリ無し・LP(index.html)に `#toc` 無し・adoc ページが navbar/`<main>`/`adoc.css`/`#toc` を保持

### 残課題
- **#4** srcset/picture/video poster / CSS `url()` の資産集約（Phase 3 計画のまま）

---

## Phase 10: LP に Lexical エディタを追加（2026-08-12）

### 目的
ランディングページ（`index.qmd`）にリッチテキストエディタ機能を追加。エディタは Meta の **Lexical**（React 版）を採用。

### 実装
- **ソース**: `editor/src/index.jsx` / `editor/src/App.jsx` / `editor/src/editor.css`
  - ツールバー: 取り消し/やり直し / 太字・斜体・下線・取消線・コード / H2・H3・段落・引用 / 箇条書き・番号付き・チェックリスト / リンク
  - `OnChangePlugin` で内容を `localStorage`（`qp-editor-state`）へ自動保存・復元
  - 文字数・単語数をフッタに表示
- **バンドル**: `tools/build-editor.mjs`（esbuild）。React+Lexical を単一 `build/editor/index.js`（+`index.css`）へ。
- **注入**: `tools/inject-editor.mjs`
  - `build/editor` の成果物を `index.js/css` → `editor/editor.js/css` にリネームして `build/site/editor/` へコピー
  - `build/site/index.html` の `<head>` に CSS、`<body>` 末尾に `<script defer>` を注入
- **index.qmd**: `## エディタ` セクション + `<div id="qp-editor-root">` マウント点を追加
- **build:all**: `clean:editor → build:editor` を quarto render 前に、`inject:editor` を render 後に追加

### 検証（jsdom スモークテスト `scripts/smoke-editor.mjs` / `npm run test:editor`）
- エディタが正常マウント（`[contenteditable]` 生成、ツールバー15ボタン）
- ツールバー全操作（H2/H3/リスト/引用/太字/undo/redo）でエラーなし
- **注意点**: `AutoLinkNode` の登録漏れで Lexical error #77 が発生。`@lexical/link` から `AutoLinkNode` を `nodes` に追加して解消

### 既知の制約
- エディタはデモ用途。内容はブラウザ localStorage のみ（サーバー保存なし）
- bundle は minify で約 628KB（React+Lexical）。当面 LP のみで許容

---

## Phase 11: 資産集約の拡張とエディタ bundle の遅延ロード（2026-08-12）

### 目的
1. 残課題 #4（srcset / picture / video / CSS url() の資産集約）に対応
2. エディタ bundle（628KB）の初回表示コストを削減

### 1. asset-sync.mjs の拡張
- 集約対象を `img[src]` から以下へ拡張:
  - `img[srcset]` / `source[srcset]`（カンマ区切り候補を個別にハッシュ集約）
  - `source[src]` / `video[src]` / `audio[src]` / `video[poster]`
  - CSS `url()`（`*.css` を走査し、data:/http(s)/# はスキップ、ローカル参照のみ集約）
- 参照パスは参照元（html/css）からの深さ相対へ書換
- 現サイトでは CSS url() は全て `data:` URI、srcset/picture/video は不使用のため実質 no-op（将来のコンテンツ向け）

### 2. validate.mjs の拡張
- 存在チェック対象を `a[href]` / `img[src]` から、`img[srcset]` / `source[src|srcset]` / `video/audio[src]` / `video[poster]` / `link[href]` / `script[src]` へ拡張

### 3. エディタ bundle の遅延ロード
- `tools/inject-editor.mjs` が `<script defer src=editor/editor.js>` を直接入れるのをやめ、**IntersectionObserver ローダー**を注入
- `#qp-editor-root` がビューポート（rootMargin 300px）に入った時のみ `editor/editor.js` を動的ロード
- 非対応ブラウザは `load()` を即時実行（フォールバック）
- 効果: LP 初回表示で 628KB の JS をダウンロード・解析しない

### 検証
- `npm run build:all` 成功、`validate: OK (9 pages, no broken anchors)`
- スモークテスト `npm run test:editor` でエディタ正常マウント（15ボタン、エラーなし）
- dist: 画像は `assets/<sha>-<name>` 集約、`images/` 無し、`IntersectionObserver` ローダー注入・eager スクリプト無し

---

## Phase 12: CI アクションの Node 20 非推奨解消（2026-08-12）

### 対応
`.github/workflows/pages.yml` のアクションを Node 24 ベースの最新メジャーへ更新:
- `actions/checkout@v4` → `@v5`
- `actions/setup-node@v4` → `@v5`
- `actions/configure-pages@v5` → `@v6`
- `actions/upload-pages-artifact@v3` → `@v4` → **`@v5`**

### 補足
- `upload-pages-artifact@v4` は内部的に `upload-artifact` の旧コミット（Node 20）を参照するため警告が残った。`@v5`（2026-04 リリース）へ更新して解消。
- デプロイは引き続き成功。Node 20 非推奨の ANNOTATIONS は表示されなくなった。

---

## Phase 13: エディタ入出力・検索検証・adoc テーマ統一（2026-08-12）

### 1. エディタのエクスポート/インポート（P1 #3）
`editor/src/App.jsx` に `ActionsPlugin` を追加（`@lexical/markdown`・`@lexical/html` を導入）:
- **MD 出力**（`$convertToMarkdownString` / `TRANSFORMERS`）、**HTML 出力**（`$generateHtmlFromNodes`）、**JSON 出力**（`toJSON`）→ Blob ダウンロード
- **JSON 読込**（hidden file input → `parseEditorState`）

### 2. サイト内検索の検証（P3 #6）
- quarto-search は `offsetURL("search.json")`（`<meta name="quarto:offset">` でページ深さごとに相対解決）で読込。ルート= `./`、docs/= `../` で `/quarto-plus/search.json` に正しく解決。
- Fuse の検索キーは `title/section/text`。`rebuild-search.mjs` の search.json はこのスキーマに一致。
- **検証結果**: 配布される `dist/search.json` は最終ID参照のみ（生日本語フラグメント 0 件）、全 68 href が実在 ID/ファイルに解決。**コード修正は不要だった**（※初回検証時に誤って quarto 生成元の `build/site/search.json` を確認したため一時的に不一致に見えた）。

### 3. adoc ページのテーマ統一（P3 #7）
- qmd ラップ方式により adoc ページは既に quarto の navbar / Bootstrap / `main.content` / `anchored` 見出しを継承。
- `themes/adoc.css` に未スタイルだった asciidoctor ブロック（`sect1/sect2` 余白・見出し、`quoteblock/sidebarblock/exampleblock/verseblock`、`ulist/olist/dlist`、`listingblock pre code`）を Bootstrap CSS 変数ベースで追加し、quarto のプローズと統一。

### 検証
- `npm run build:all` 成功、`validate: OK (9 pages)`
- `npm run test:editor`: エクスポート3種 + JSON 読込 → MD 出力のラウンドトリップ成功（`## 見出しテスト / **太字の段落** / Hello world`）
- adoc ページに `themes/adoc.css` 適用を確認






---

## Phase 14: LP表示のずれ修正（2026-08-12）

### 報告された不具合（Chrome headless + CDP で座標実測）
1. 黒字の「quarto-plus」（quarto標準の `#title-block-header` の h1.title）が hero に下から17px重ねられ、文字下部が切れて見える
   - hero の `margin-top: -2rem` がタイトルブロックを覆っていた
2. エディタのプレースホルダ「ここに入力してください」が、ツールバー高さ分（約48.6px）上にずれて表示
   - RichTextPlugin は contentEditable と placeholder を兄弟要素として直接出力する。placeholder は `.ed-card`（relative）基準の `top:1rem` だが、content の1行目はツールバーを挟んだ先にあるため、相対位置が合わなかった

### 対応
- `themes/lp.css`: `#title-block-header { display:none }` を追加（LPはヒーローがタイトルを担うため）
  - → hero が navbar 直下（top≈58px）にフラッシュ配置される
- `editor/src/App.jsx`: RichTextPlugin を `<div class="ed-body">` でラップ
- `editor/src/editor.css`: `.ed-body { position:relative }` を追加。`.ed-placeholder` に `line-height:1.7` を設定し content の1行目と揃える

### 検証（CDP再測定）
- `#title-block-header`: w/h=0（非表示確認）。hero top 58px（navbar直下、重なり無し）
- `.ed-placeholder` top=473.7 / line-height=28.9 が、`.ed-content` の1行目（top=473.7 / line-height=28.9）と完全一致
- `npm run build:all` 成功（validate OK）、`npm run test:editor` 正常（15ボタン・入出力ラウンドトリップ成功）

---

## Phase 15: テンプレートライブラリ再編（2026-08-13）

### 方針転換
LP は「チュートリアルとしての立ち位置」に簡素化し、本体（docs/）に **実用雛形（コピペ用テンプレート）** を多数整備。`watanabe3tipapa/okf-seedling` の「concept 型 × frontmatter レジストリ」の方式を移植した。

### 1. エディタ完全削除（Phase 10-14 の機能を廃止）
- `editor/`（ソース・CSS）、`tools/build-editor.mjs`、`tools/inject-editor.mjs`、`scripts/smoke-editor.mjs` を削除
- `package.json`: エディタ関連スクリプト・依存（lexical / react / esbuild / jsdom）を除去。`build:all` から該当ステップを除去
- `index.qmd` から `#qp-editor-root` / `editor-section` を除去。`themes/lp.css` の `.editor-section` を除去

### 2. LP 刷新（チュートリアル導線化）
- hero + 「このサイトの読み方」（チュートリアル → テンプレート → DOM仕様）+ テンプレート型一覧 + パイプライン図
- 機能カード・エディタデモを廃止し、okf-seedling の index と同型の「まず読んでほしい」構成へ

### 3. テンプレートライブラリ（docs/templates/）
**実用雛形 34 ページ**（qmd 15 / md 14 / adoc 5）+ カタログ `docs/templates/index.qmd`
- qmd: basic / playbook / runbook / troubleshooting / api-overview / api-endpoint / api-schema / design-doc / proposal / research-note / how-to / faq / onboarding / blog-post / report
- md: basic / advanced（旧 `docs/guide.md` を移設・趣意変更）/ adr / decision-log / meeting-notes / reading-notes / release-notes / changelog / incident-report / weekly-report / status-report / glossary / cheatsheet / comparison
- adoc: basic / playbook / api-reference / meeting-notes / cheatsheet（`adoc/templates/`、adoc.css の実証を兼ねる）

### 4. doc-type レジストリ + バリデータ（okf-seedling 流）
- `tools/doc-types.json`: 28 型 × 必須見出しを定義し、`templates` マニフェスト（34 ファイル → 型）を保持
- `tools/validate-doc-types.mjs`: 各雛形のソース見出し（qmd/md は `#`、adoc は `=`）が必須見出しを満たすか検査。コードフェンスを除外
- `package.json` の `build:all` 末尾に `validate:templates` を追加

### 5. adoc URL 改善（`build/adoc-qmd/` → `adoc-pages/`）
- `tools/config.mjs`: `ADOC_QMD_DIR` をルート直下 `adoc-pages/` へ変更
- `_quarto.yml` の render を `- adoc-pages/` へ、`.gitignore` に `adoc-pages/` を追加、`clean:adoc` を更新
- 効果: 公開 URL が `…/build/adoc-qmd/…` → `…/adoc-pages/…` になり、ビルド内部パスが URL に露出しない

### 6. demo/ 統合 + ナビゲーション
- `demo/`・`adoc/demo/` を削除。コンテンツはテンプレートへ吸収（`demo/images/*` → `docs/templates/images/`、`adoc/demo/images/*` → `adoc/templates/images/`）
- navbar: Home / Tutorial / Templates / Docs（`docs/templates/index.html` を追加、Demo を除去）

### 7. 実装時に踏んだ罠
- **quarto の md 見出しアンカーは正規化される**: `節: なぜ階層を揃えるのか` → `data-anchor-id="節-なぜ階層を揃えるのか"`（`:` 除去・空白を `-` に）。自己リンクは quarto の正規化後形式で書く（`#節: …` では harmonize の idMap に一致せず validate が検出）
- **docs/ 配下ページから templates への相対パスは `templates/…`**（`../templates/…` は site 直下を指し切れる）

### 検証
- `npm run build:all` 成功、`validate: OK (40 pages, no broken anchors)`、`validate-doc-types: OK (19 templates checked)`、`rebuild-search: 242 entries`（生日本語フラグメント 0）
- dist: 全 40 ページ、`images/` ディレクトリ無し（`assets/<sha>-<name>` 集約）、`.nojekyll` 生成、adoc ページが navbar / `adoc.css` / `<main>` を保持、URL に `build/` が残らない、エディタ成果物・demo 無し
- LP: `#toc` 無し・エディタローダー無し・hero 導線構成

---

## Phase 16: README 整備と v0.3.0 バージョン確定（2026-08-13）

### 対応
- `README.md` / `README_en.md` を新規作成（`okf-seedling` の README 構成に倣う）
  - タグライン「文書は、書くときは自由。届けるときは、ひとつに。」
  - バッジ: MIT / v0.3.0 / GitHub Pages live / issues
  - コンセプト表（書くとき ↔ 届けるとき の対応物）・フォーマット非競合の説明・ドキュメント向けリンター
  - インストール（前提条件表 + clone → npm install → build:all → deploy）
  - テンプレート一覧（qmd 15 / md 14 / adoc 5）・読書順・コントリビューション・ライセンス
- `LICENSE`（MIT）を新規作成（okf-seedling と同内容）
- `package.json` / `package-lock.json` のバージョンを **0.1.0 → 0.3.0** へ更新

### 備考
- ルートの README.md / LICENSE は quarto の render 対象外（`render:` が index.qmd / docs/ / adoc-pages/ の明示指定のため）。サイトには影響しない
- サイト内の導線・テンプレートカタログはそのまま README のリンク先として機能

### 検証
- `npm run build:all` 成功（v0.3.0）、`validate: OK (40 pages, no broken anchors)`、`validate-doc-types: OK (19 templates)`

---

## 技術的な参考事項: MDV（.mdv）の参考収録（2026-09-01）

### 背景・趣旨
quarto-plus の本体パイプライン（`.md/.qmd/.adoc` を harmonize して単一サイトへ統合）とは**別系統**の仕組みとして、[drasimwagan/mdv](https://github.com/drasimwagan/mdv)（Markdown スーパーセットでチャート・KPI・テーブル入りの自己完結 HTML/PDF を生成するツール）の存在を**参考**として同梱した。**常用しない**ことを明示し、「こういう仕組みもある」という知見提供を目的とする。

### 対応
- `docs/templates/mdv/basic.mdv` / `dashboard.mdv` — 参考用 `.mdv` テンプレート（chart / stat / table / `:::` コンテナ / columns の見本）
- `docs/reference/mdv.qmd` — MDV の紹介・ローカル導入手順・制約の解説（参考）
- `docs/reference/mdv-qmd-comparison.qmd` — `.mdv` と `.qmd` の詳細比較（設計思想・構文・機能・用途）を Quarto 化
- 導線: テンプレートカタログ / docs トップ / LP / README（日英）に MDV の参考案内を追記

### 技術ポイント
- **mdv は npm レジストリ未公開**。導入は GitHub clone → `npm install` → `npm run build` → `node packages/mdv-cli/dist/index.js render <file>.mdv`（`render` / `preview` / `export --pdf` / `version`）。Node >= 20 が必要（本リポジトリと同じ要件）。
- **`.mdv` は quarto の render 対象拡張子ではない**ため、`docs/` 配下に置いても render されない。ただし `build/site-harmonized` を通るため `dist/` へ静的ファイルとしてコピーされる（カタログから `mdv/basic.mdv` へのリンクが機能する）。

### Quarto でのコード例表示の罠（比較ページの実装で踏んだ）
- **` ```{python} `（中括弧付き）は、外側のコードフェンス（3/4バックティック、`text`/`markdown` 言語）内にネストしても quarto が再帰的に実行ブロックと解釈し、Jupyter カーネルを起動する**。`eval: false` でもカーネル初期化を試みるため、Jupyter 未導入環境では render が失敗する。
- 回避策: 表示用のコード例では `{python}` の**中括弧を外して ` ```python ` `（角括弧なし）**にする。` ```python ` ` ` は実行されない表示専用のコードブロックとして扱われる（`Jupyter 不要で render 成功`）。

### 既存問題の修正: dashboard 由来の validate エラー
- Phase 17 で追加された dashboard テンプレートは、quarto 出力で同一 `id="quarto-bootstrap"` / `id="quarto-text-highlighting-styles"` を持つ **`<link>` 要素を1ページに複数出力**する（light/dark CSS + 重複）。
- そのため `tools/validate.mjs` の重複ID検査が誤検出し、`build:all` が失敗していた。**この環境では Jupyter 未導入のため dashboard ページの render が従来失敗しており、Phase 17 後に validate が通るか検証されていなかった**。
- 対応: `loadIds` で **`<link id>` を重複ID検査の対象から除外**（`<link>` はリソース読み込みタグの識別子でアンカー対象ではないため、重複しても実害なし）。

### 検証
- `QUARTO_PYTHON=<venv>/bin/python`（jupyter + matplotlib + pandas を入れた venv）で `npm run build:all` 成功。
- `validate: OK (52 pages, no broken anchors)`、`validate-doc-types: OK (19 templates)`、`copy-dist: 170 files -> dist/`
- `dist/docs/reference/mdv.html` / `mdv-qmd-comparison.html` と `dist/docs/templates/mdv/*.mdv` の出力を確認。
- 比較ページ・MDV 紹介ページは Jupyter 不要で単独 render 成功（コード例を ` ```python ` ` 表記にしたため）。

### 検証時メモ（環境）
- 本リポジトリに asciidoctor / Jupyter が未導入だったため、`brew install asciidoctor` と venv への `jupyter` 系インストールでビルドを検証した。CI（GitHub Actions）では既に Ruby(asciidoctor) + Node + Quarto を導入済みだが、dashboard の Jupyter 実行要件を満たすための Python/カーネル設定を要検討。なお dashboard は `format: dashboard` で python セルを含むため、**本番ビルドでも Jupyter + matplotlib が必要**。

---

## Phase 18: MDV 参考収録・CI 修正・v0.3.2 確定（2026-09-01）

### 対応
- **MDV（`.mdv`）の参考収録**（技術的な参考事項として前述）
  - `docs/templates/mdv/basic.mdv` / `dashboard.mdv`、`docs/reference/mdv.qmd` / `mdv-qmd-comparison.qmd`
  - カタログ / docs トップ / LP / README（日英）/ DEV-MEMO に案内追記
- **CI 修正**: `.github/workflows/pages.yml`
  - `pip install matplotlib numpy` → **`pip install jupyter matplotlib numpy`** に変更
  - Build site に **`QUARTO_PYTHON: python3`** を env 設定
  - 背景: Phase 17 で追加した dashboard テンプレートは `format: dashboard` の python セルを持つ。Jupyter 未導入のため CI は **Phase 17 の時点から既に失敗していた**（`No module named 'yaml'` で quarto がカーネルを起動できず）。本プッシュで解消し、GitHub Actions の **Success** と GitHub Pages デプロイを確認。
- **バージョン**: `0.1.0 → 0.3.0 → **0.3.2**`（v0.3.1 はスキップ。本 Phase の成果を v0.3.2 として確定）

### 整合性を図った箇所
- `package.json` / `package-lock.json` — `version: 0.3.2`
- `README.md` / `README_en.md` — Version バッジを `v0.3.0` → `v0.3.2` に更新
- DEV-MEMO — Phase 16 の「v0.3.0 確定」記録は当時の履歴としてそのまま維持

### 検証
- ローカル `QUARTO_PYTHON=<venv>/bin/python` で `npm run build:all` 成功、`validate: OK (52 pages, no broken anchors)`、`validate-doc-types: OK (19 templates)`、`copy-dist: 170 files`
- GitHub Actions（Deploy to GitHub Pages）**Success**、GitHub Pages へのデプロイ成功を `gh run` で確認


