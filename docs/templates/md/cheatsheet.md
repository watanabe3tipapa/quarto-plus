---
title: "チートシート（Cheatsheet）テンプレート"
---

頻出操作を一覧で引けるようにまとめます。コードはコピーして使えます。

## ビルド

| 操作 | コマンド |
|---|---|
| 通しビルド | `npm run build:all` |
| サイトのみ再ビルド | `npm run build:site` |
| 検証のみ | `npm run validate` |

## 文書を追加する

1. `docs/` 配下に `.qmd` または `.md` を作成する
2. `adoc/` 配下に `.adoc` を作成する
3. `npm run build:all` を実行する

## 見出し ID のルール

- 形式: `pagePrefix-<slug>`
- 日本語はかな → ローマ字、未対応文字は `_`
- 同一ページ内の重複は `-2`, `-3` を付与

## 関連

- [テンプレートカタログ](../index.html)