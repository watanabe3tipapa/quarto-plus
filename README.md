# quarto-plus

**文書は、書くときは自由。届けるときは、ひとつに。**

quarto-plus は、`.md` / `.qmd` / `.adoc` で書かれたドキュメントを単一の静的サイトへ統合し、検証済みの HTML として出力する Quarto ベースのパイプラインツールです。実用に使える雛形（テンプレートライブラリ）を同梱し、サイトの整合性を保つための検証機能も備えています。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)](https://github.com/watanabe3tipapa/quarto-plus/releases)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue.svg)](https://watanabe3tipapa.github.io/quarto-plus/)
[![GitHub](https://img.shields.io/github/issues/watanabe3tipapa/quarto-plus.svg)](https://github.com/watanabe3tipapa/quarto-plus/issues)

[日本語](README.md) | [English](README_en.md)

## コンセプト

### なぜ「＋（プラス）」なのか

書き手はそれぞれ得意なフォーマットで執筆し、読み手には一貫したサイトとして届ける――その橋渡しをするのが quarto-plus です。`.md` / `.qmd` / `.adoc` といった複数フォーマットを混在させたまま同一ルールで公開できるように、文書の正規化・結合・検証・出力を行います。

### フォーマットの使い分け

- `.md` : シンプルな文書（例: リリースノート、議事録、用語集）
- `.qmd`: Quarto の拡張を活かした文書（例: 手順書、設計メモ、レポート）
- `.adoc`: AsciiDoc のブロック表現を活かす文書（例: API 仕様、チートシート）

quarto-plus は書き手の選択を尊重し、公開時に見出し ID・目次・アセット参照を統一します。

### ドキュメント向けリンター

文書サイトの品質を保つための検証機能を備えています。主な検証項目は:

- 同一ページ・クロスページのアンカー（フラグメント）解決
- 画像・CSS・JS の存在確認
- 重複見出し ID の検出
- テンプレートに対する必須見出しチェック（registry 駆動、tools/doc-types.json）

## 主な特徴

- `.md` / `.qmd` / `.adoc` を統合して単一サイトを生成（quarto render と Asciidoctor を組合せ）
- 見出し ID を `pagePrefix-<slug>` 形式で統一（日本語はかな→ローマ字に正規化、重複は `-2`, `-3` を付与）
- `h2..h6` から入れ子構造の `#toc` を自動生成
- 画像を内容ハッシュ名 `assets/<sha>-<basename>` で集約し、参照を自動書換
- クロスページアンカーを解決し、Quarto と Asciidoctor 起源の参照を揃えるフォールバックを実装
- 34 種の実用雛形（テンプレートライブラリ）を同梱（`.qmd` 15 / `.md` 14 / `.adoc` 5）
- 別系統の仕組み **MDV（`.mdv`）** の参考収録（Markdown 単体でチャート入り HTML/PDF を生成。常用せず）
- 検証はレジストリ（tools/doc-types.json）駆動
- harmonize 後に `search.json` を再生成してサイト内検索のリンク切れを防止
- GitHub Actions による GitHub Pages への自動デプロイ（リポジトリ設定に依存）

## インストールとビルド

### 前提条件

| ツール | 必要バージョン | 確認コマンド |
|---|---:|---|
| Quarto | >= 1.3 | `quarto --version` |
| Node.js | >= 20 | `node --version` |
| Asciidoctor（`.adoc` を使う場合） | >= 2.0 | `asciidoctor --version` |
| Git | 任意（デプロイ・貢献時） | `git --version` |

macOS では `brew install quarto node asciidoctor` で揃えられます。Windows / Linux は各公式インストーラを参照してください。

### 基本的な手順（確認できる手順のみ）

1. リポジトリを取得

```bash
git clone https://github.com/watanabe3tipapa/quarto-plus.git
cd quarto-plus
```

2. 依存をインストール

```bash
npm install
```

3. ビルド

```bash
npm run build:all
```

ビルド結果は `dist/` に出力されます。

ビルドの概念図（ツールの流れ）:

```
adoc → html ─┐
              ├→ merge → harmonize → asset-sync → validate → validate-doc-types → dist/
quarto render ┘
```

### 公開

リポジトリの `main` ブランチへの push で自動的にビルド・デプロイが行われる設定になっています。詳細な手順やチュートリアルは公開ドキュメントを参照してください。

## テンプレート（実用雛形）

`docs/templates/` に 34 種類の雛形を同梱しています。雛形はそのままコピーして内容を差し替えるだけで利用できます。一覧はテンプレートカタログで確認してください。

- フォーマット別収録数: `.qmd` 15 / `.md` 14 / `.adoc` 5
- **MDV（`.mdv`）を別系統の仕組みとして参考収録**（Markdown 単体のチャート入りレポート用。常用しません。導入方法は [MDV とは（参考）](docs/reference/mdv.html) を参照）
- テンプレートカタログ: https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html

## ドキュメント

初心者は次の順で読むと全体像が把握しやすいです。

1. チュートリアル — パイプラインの全体像と使い方
   (https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html)
2. テンプレートカタログ — 実用雛形一覧
   (https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html)
3. DOM 構造の解説 — 見出し ID・目次・リンク・画像の正規化ルール
   (https://watanabe3tipapa.github.io/quarto-plus/docs/dom-structure.html)

開発メモはリポジトリの DEV-MEMO.md を参照してください。

## コントリビューション

コントリビューションは歓迎します。大きな変更を行う前に Issue を立てて相談してください。一般的な手順:

1. リポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/your-feature`)
3. 変更をコミット (`git commit -m 'Add your feature'`)
4. ブランチをプッシュし、Pull Request を作成

Issue や PR はリポジトリの Issue ページで管理されています。

## 連絡先

- GitHub: https://github.com/watanabe3tipapa/quarto-plus
- 公開サイト: https://watanabe3tipapa.github.io/quarto-plus/

## ライセンス

MIT ライセンス — 詳細はリポジトリの LICENSE ファイルを参照してください。
