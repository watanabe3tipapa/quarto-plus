# quarto-plus

**文書は、書くときは自由。届けるときは、ひとつに。**

quarto-plus は、`.md` / `.qmd` / `.adoc` で書かれたドキュメントを単一の静的サイトへ統合し、検証済みの HTML として出力する Quarto ベースのパイプラインツールです。実用に使える雛形（テンプレートライブラリ）、Colab 上で Quarto を動かす実践ガイドも同梱しています。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.3.3-blue.svg)](https://github.com/watanabe3tipapa/quarto-plus/releases)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue.svg)](https://watanabe3tipapa.github.io/quarto-plus/)
[![GitHub](https://img.shields.io/github/issues/watanabe3tipapa/quarto-plus.svg)](https://github.com/watanabe3tipapa/quarto-plus/issues)

[日本語](README.md) | [English](README_en.md)

**クイックリンク:** [公開サイト](https://watanabe3tipapa.github.io/quarto-plus/) · [チュートリアル](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) · [テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) · [DOM 構造の解説](https://watanabe3tipapa.github.io/quarto-plus/docs/dom-structure.html) · [Colab 完全ガイド](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/colab-guide.html) · [Open in Colab](https://colab.research.google.com/github/watanabe3tipapa/quarto-plus/blob/main/colab/quarto-colab.ipynb)

## コンセプト

### なぜ「＋（プラス）」なのか

書き手はそれぞれ得意なフォーマットで執筆し、読み手には一貫したサイトとして届ける――その橋渡しをするのが quarto-plus です。`.md` / `.qmd` / `.adoc` といった複数フォーマットを混在させたまま同一ルールで公開できるように、文書の正規化・結合・検証・出力を行います。

| 営み | quarto-plus の対応物 |
|---|---|
| 任意フォーマットで書く | `.md` / `.qmd` / `.adoc` で執筆 |
| 散らばる見出しを揃える | harmonize が ID を `pagePrefix-<slug>` に正規化 |
| ページに目次を付ける | `h2..h6` から入れ子の `#toc` を生成 |
| 画像を集める | asset-sync が `assets/<sha>-<name>` に集約し参照を書換 |
| リンク切れを防ぐ | validate が同一・クロスページのアンカーとファイルを検査 |
| 最初の一歩を軽くする | 34 種の実用雛形を同梱 |
| 公開する | GitHub Actions で GitHub Pages へ自動デプロイ |

### フォーマットの使い分け

- `.md`: シンプルな文書（例: リリースノート、議事録、用語集）
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

### パイプライン

- `.md` / `.qmd` / `.adoc` を統合して単一サイトを生成（quarto render と Asciidoctor を組み合わせ）
- 見出し ID を `pagePrefix-<slug>` 形式で統一（日本語はかな→ローマ字に正規化、重複は `-2`, `-3` を付与）
- `h2..h6` から入れ子構造の `#toc` を自動生成
- 画像を内容ハッシュ名 `assets/<sha>-<basename>` で集約し、参照を自動書換
- クロスページアンカーを解決し、Quarto と Asciidoctor 起源の参照を揃えるフォールバックを実装
- リンク・画像・重複 ID を検証（`validate`）、テンプレートの必須見出しをチェック（`validate:templates`、registry 駆動）
- harmonize 後に `search.json` を再生成してサイト内検索のリンク切れを防止
- GitHub Actions による GitHub Pages への自動デプロイ

### 同梱コンテンツ

- **34 種の実用雛形**（`.qmd` 15 / `.md` 14 / `.adoc` 5）— 一覧は[テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html)
- **MDV（`.mdv`）の参考収録** — 別系統の仕組み。Markdown 単体でチャート入り HTML/PDF を生成（[MDV とは（参考）](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/mdv.html)）
- **[Google Colab で Quarto を使いまくる完全ガイド](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/colab-guide.html)** — CLI 導入から `.qmd` / `.ipynb` のレンダリング、**実践用例**（e-Stat レポート化・ブログ公開・ダッシュボード・拡張プロジェクト）まで
- **Colab ノートブック雛形** — 次の「Colab で試す」から自分の Colab に開ける

## Colab で試す（参考）

リポジトリを clone しなくても、ブラウザだけで Quarto を試せます。

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/watanabe3tipapa/quarto-plus/blob/main/colab/quarto-colab.ipynb)

- **雛形ノートブック** [`colab/quarto-colab.ipynb`](colab/quarto-colab.ipynb) — セルを順に実行すると、Quarto CLI の導入 → `.qmd` 作成と HTML レンダリング → プロジェクト構築 → Google Drive 永続化まで一通り動く
- **[完全ガイド](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/colab-guide.html)** — 実践用例として e-Stat 政府統計データのレポート化、ブログの `quarto publish`、`format: dashboard` のダッシュボード生成、Lua フィルタ / post-render 付きプロジェクトのビルドを収録

## インストールとビルド

### 前提条件

| ツール | 必要バージョン | 確認コマンド |
|---|---:|---|
| Quarto | >= 1.3 | `quarto --version` |
| Node.js | >= 20 | `node --version` |
| Asciidoctor（`.adoc` を使う場合） | >= 2.0 | `asciidoctor --version` |
| Git | 任意（デプロイ・貢献時） | `git --version` |

macOS では `brew install quarto node asciidoctor` で揃えられます。Windows / Linux は各公式インストーラを参照してください。

### 基本的な手順

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

### 主要コマンド

| コマンド | 用途 |
|---|---|
| `npm run build:all` | adoc 変換 → quarto render → merge → harmonize → 検証 → `dist/` まで一括 |
| `npm run validate` | リンク・画像・重複 ID の検証のみ実行 |
| `npm run validate:templates` | テンプレートの必須見出しチェック（`tools/doc-types.json`） |
| `npm run rebuild:search` | harmonize 後に `search.json` を再生成 |

### 公開

リポジトリの `main` ブランチへの push で自動的にビルド・デプロイが行われる設定になっています。詳細な手順は[チュートリアル](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html)を参照してください。

## テンプレート（実用雛形）

`docs/templates/` に 34 種類の雛形を同梱しています。雛形はそのままコピーして内容を差し替えるだけで利用できます。一覧は[テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html)で確認してください。

| フォーマット | 収録数 | 例 |
|---|---|---|
| `.qmd` | 15 | 手順書 / 運用手順 / API 仕様 / 設計メモ / 提案書 / 調査ノート / FAQ |
| `.md` | 14 | 議事録 / リリースノート / 障害報告 / 用語集 / チートシート / 比較検討 |
| `.adoc` | 5 | 手順書 / API 仕様 / 議事録 / チートシート |
| `.mdv`（参考） | 2 | 基本 / ダッシュボード（別系統の仕組み。常用しません） |

- MDV の導入方法は [MDV とは（参考）](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/mdv.html)、使い分けは [.mdv と .qmd の詳細比較](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/mdv-qmd-comparison.html) を参照

## ドキュメント

初心者は次の順で読むと全体像が把握しやすいです。

1. [チュートリアル](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) — パイプラインの全体像と使い方
2. [テンプレートカタログ](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) — 実用雛形一覧
3. [DOM 構造の解説](https://watanabe3tipapa.github.io/quarto-plus/docs/dom-structure.html) — 見出し ID・目次・リンク・画像の正規化ルール
4. [Google Colab で Quarto を使いまくる完全ガイド](https://watanabe3tipapa.github.io/quarto-plus/docs/reference/colab-guide.html) — Colab 上での実践と実践用例（参考）

開発メモはリポジトリの [DEV-MEMO.md](DEV-MEMO.md) を参照してください。

## コントリビューション

コントリビューションは歓迎します。大きな変更を行う前に [Issue](https://github.com/watanabe3tipapa/quarto-plus/issues) を立てて相談してください。一般的な手順:

1. リポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/your-feature`)
3. 変更をコミット (`git commit -m 'Add your feature'`)
4. ブランチをプッシュし、Pull Request を作成

## 連絡先

- GitHub: https://github.com/watanabe3tipapa/quarto-plus
- 公開サイト: https://watanabe3tipapa.github.io/quarto-plus/

## ライセンス

MIT ライセンス — 詳細はリポジトリの [LICENSE](LICENSE) ファイルを参照してください。
