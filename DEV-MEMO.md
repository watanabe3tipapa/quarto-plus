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
