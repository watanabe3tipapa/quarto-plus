# quarto-plus

**文書は、書くときは自由。届けるときは、ひとつに。**

quarto-plus は、`.md` / `.qmd` / `.adoc` で書かれたドキュメントを **単一の静的サイト** へ統合し、検証済みの HTML として公開する Quarto ベースのパイプラインツールです。あわせて、コピーしてそのまま使える **実用雛形（テンプレートライブラリ）** を同梱します。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)](https://github.com/watanabe3tipapa/quarto-plus/releases)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue.svg)](https://watanabe3tipapa.github.io/quarto-plus/)
[![GitHub](https://img.shields.io/github/issues/watanabe3tipapa/quarto-plus.svg)](https://github.com/watanabe3tipapa/quarto-plus/issues)

[日本語](README.md) | [English](README_en.md)

## コンセプト

### なぜ「＋（プラス）」なのか

フォーマットは、それぞれに得意な表現があります。マークダウンは軽く、Quarto Markdown はコールアウトや図解を活かし、AsciiDoc は厳密なブロック構文を持ちます。

quarto-plus はそのどれかを選ばせません。**書き手には得意なフォーマットを、読み手にはひとつのサイトを。** バラバラに書かれた文書を「＋」して、同じルールのひとつの場所に合流させます。

| 営み | quarto-plus の対応物 |
|---|---|
| 好きなフォーマットで書く | `.md` / `.qmd` / `.adoc` のいずれでも執筆 |
| バラバラの見出しを揃える | harmonize が `pagePrefix-<slug>` の一意な ID に正規化 |
| ページに目次を持たせる | `h2..h6` から入れ子構造の `#toc` を自動生成 |
| 画像をまとめる | asset-sync が `assets/<sha>-<name>` に集約し、参照を自動書換 |
| リンク切れを防ぐ | validate が同一ページ・クロスページのアンカーとファイルを検証 |
| 最初の一歩を早める | 34 種の実用雛形（テンプレートライブラリ）を同梱 |
| 公開する | GitHub Actions による GitHub Pages への自動デプロイ |

### フォーマットは競合しない

`.md` / `.qmd` / `.adoc` は対立する選択肢ではありません。**フォーマットは書き手が選び、統合は quarto-plus が担います。**

- **`.md`** = シンプルな文書（リリースノート・議事録・用語集）
- **`.qmd`** = コールアウト・mermaid・コードを活かす文書（手順書・設計メモ・レポート）
- **`.adoc`** = admonition・テーブルなどのブロック構文を持つ文書（チートシート・API 仕様）

どのフォーマットで書いても、公開後は同じ `pagePrefix-<slug>` の見出し ID、同じ `#toc`、同じ `assets/` 参照に揃います。

### ドキュメント向けリンター

単に「作る」だけでなく「**正しく整っているか**」も見ます。ESLint がコードを見るように、このツールは文書サイトを対象にした検証を内蔵しています。

- **リンク検証（validate）**: 同一ページ・クロスページのフラグメント解決、画像・CSS・JS の存在、重複 ID の検出
- **型検証（validate-doc-types）**: テンプレートが `tools/doc-types.json` の必須見出しを満たすか

## 特徴

- `.md` / `.qmd` / `.adoc` を単一サイトへ統合（quarto render + asciidoctor → harmonize）
- 見出し ID を `pagePrefix-<slug>` で統一（日本語はかな → ローマ字、重複は `-2`, `-3`）
- `h2..h6` から入れ子構造の `#toc` を自動生成
- 画像を内容ハッシュ名 `assets/<sha>-<basename>` で集約し、参照パスを自動書換
- クロスページアンカーを解決（quarto / asciidoctor 由来を同じフォールバックで）
- **34 種の実用雛形**（`.qmd` 15 / `.md` 14 / `.adoc` 5）とカタログページ
- レジストリ駆動の検証: `tools/doc-types.json` を source of truth とし、必須見出しチェックを駆動
- `search.json` を harmonize 後に再生成し、サイト内検索のリンク切れを防止
- GitHub Actions による GitHub Pages への自動デプロイ

## インストール

### 前提条件

| ツール | 必要バージョン | 確認コマンド |
|---|---|---|
| [Quarto](https://quarto.org/docs/get-started/) | >= 1.3 | `quarto --version` |
| [Node.js](https://nodejs.org/) | >= 20 | `node --version` |
| [Asciidoctor](https://asciidoctor.org) | >= 2.0（`.adoc` を使う場合のみ） | `asciidoctor --version` |
| Git | 任意（デプロイ・貢献時） | `git --version` |

macOS では `brew install quarto node asciidoctor` で揃えられます。Windows / Linux は各公式インストーラを参照してください。

### 1. リポジトリを取得する

```bash
git clone https://github.com/watanabe3tipapa/quarto-plus.git
cd quarto-plus
```

### 2. 依存をインストールする

```bash
npm install
```

### 3. ビルドする

```bash
npm run build:all
```

`dist/` に検証済みのサイトが出力されます。

```
adoc → html ─┐
              ├→ merge → harmonize → asset-sync → validate → validate-doc-types → dist/
quarto render ┘
```

### 4. 公開する

`main` への push で GitHub Actions が自動でビルド・デプロイします。手順の詳細は [チュートリアル](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) を参照してください。

## テンプレート（実用雛形）

`docs/templates/` に **34 種の実用雛形** を同梱しています。気に入った型をコピーして内容を差し替えるだけで使えます。一覧は [テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) を参照してください。

| フォーマット | 収録数 | 例 |
|---|---|---|
| `.qmd` | 15 | 手順書 / 運用手順 / API 仕様 / 設計メモ / 提案書 / FAQ / 調査ノート / レポート |
| `.md` | 14 | 議事録 / ADR / リリースノート / 障害報告 / 用語集 / チートシート / 比較検討 |
| `.adoc` | 5 | 手順書 / API 仕様 / 議事録 / チートシート |

## ドキュメント

初心者の方は **この順** で読むと全体像が掴めます。

1. [チュートリアル](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) — パイプラインの全体像と使い方
2. [テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) — 実用雛形の一覧
3. [DOM 構造の解説](https://watanabe3tipapa.github.io/quarto-plus/docs/dom-structure.html) — 見出し ID・目次・リンク・画像の正規化ルール

開発メモは [DEV-MEMO](DEV-MEMO.md) を参照してください。

## コントリビューション

コントリビューションは大歓迎です。大きな変更を進める前に、まず [issue](https://github.com/watanabe3tipapa/quarto-plus/issues) を開いて内容を共有してください。

1. リポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

## 連絡先

GitHub: [https://github.com/watanabe3tipapa/quarto-plus](https://github.com/watanabe3tipapa/quarto-plus)

公開サイト: [https://watanabe3tipapa.github.io/quarto-plus/](https://watanabe3tipapa.github.io/quarto-plus/)

## ライセンス

MITライセンス — 詳細は [LICENSE](LICENSE) ファイルを参照してください。
