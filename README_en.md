# quarto-plus

**Write freely. Publish as one.**

quarto-plus is a Quarto-based pipeline tool that merges documents written in `.md` / `.qmd` / `.adoc` into a **single static site** and publishes them as validated HTML. It also ships a library of **practical templates** you can copy and use right away.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)](https://github.com/watanabe3tipapa/quarto-plus/releases)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue.svg)](https://watanabe3tipapa.github.io/quarto-plus/)
[![GitHub](https://img.shields.io/github/issues/watanabe3tipapa/quarto-plus.svg)](https://github.com/watanabe3tipapa/quarto-plus/issues)

[日本語](README.md) | [English](README_en.md)

## Concept

### Why "Plus"

Each format has its own strengths. Markdown is lightweight, Quarto Markdown excels with callouts and diagrams, and AsciiDoc offers strict block syntax.

quarto-plus does not force you to pick one. **Writers use their preferred format; readers get a single site.** Documents written separately are "plus"-ed together and converged into one place under the same rules.

| Activity | quarto-plus counterpart |
|---|---|
| Write in any format | Author in `.md` / `.qmd` / `.adoc` |
| Unify scattered headings | harmonize normalizes IDs to `pagePrefix-<slug>` |
| Give pages a table of contents | `#toc` is generated from `h2..h6` |
| Consolidate images | asset-sync aggregates into `assets/<sha>-<name>` and rewrites references |
| Prevent broken links | validate checks same-page and cross-page anchors and files |
| Accelerate the first step | Ships 34 practical templates |
| Publish | Automatic GitHub Pages deploy via GitHub Actions |

### Formats Are Not Rivals

`.md` / `.qmd` / `.adoc` are not competing choices. **Writers choose the format; quarto-plus handles the integration.**

- **`.md`** = simple documents (release notes, meeting notes, glossary)
- **`.qmd`** = documents that use callouts, mermaid, and code (playbooks, design docs, reports)
- **`.adoc`** = documents with admonitions and tables (cheatsheets, API references)

No matter which format you write in, the published result shares the same `pagePrefix-<slug>` heading IDs, the same `#toc`, and the same `assets/` references.

### A Linter for Documentation Sites

This tool does not just build — it checks that things are **correctly assembled**. Just as ESLint reviews code, quarto-plus has built-in validation for documentation sites.

- **Link validation (`validate`)**: same-page and cross-page fragment resolution, existence of images/CSS/JS, duplicate ID detection
- **Template validation (`validate-doc-types`)**: templates must satisfy the required headings defined in `tools/doc-types.json`

## Features

- Integrates `.md` / `.qmd` / `.adoc` into a single site (quarto render + asciidoctor → harmonize)
- Unifies heading IDs as `pagePrefix-<slug>` (kana → romaji, duplicates get `-2`, `-3`)
- Auto-generates a nested `#toc` from `h2..h6`
- Aggregates images under content-hash names `assets/<sha>-<basename>` and rewrites reference paths
- Resolves cross-page anchors (with the same fallback for quarto / asciidoctor origins)
- **34 practical templates** (15 `.qmd` / 14 `.md` / 5 `.adoc`) plus a catalog page
- Registry-driven validation: `tools/doc-types.json` is the source of truth driving required-heading checks
- Regenerates `search.json` after harmonize to prevent broken site-search links
- Automatic GitHub Pages deployment via GitHub Actions

## Installation

### Prerequisites

| Tool | Required version | Check command |
|---|---|---|
| [Quarto](https://quarto.org/docs/get-started/) | >= 1.3 | `quarto --version` |
| [Node.js](https://nodejs.org/) | >= 20 | `node --version` |
| [Asciidoctor](https://asciidoctor.org) | >= 2.0 (only if using `.adoc`) | `asciidoctor --version` |
| Git | optional (deploy / contribution) | `git --version` |

On macOS you can install everything with `brew install quarto node asciidoctor`. See the official installers for Windows / Linux.

### 1. Get the repository

```bash
git clone https://github.com/watanabe3tipapa/quarto-plus.git
cd quarto-plus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build:all
```

A validated site is output to `dist/`.

```
adoc → html ─┐
              ├→ merge → harmonize → asset-sync → validate → validate-doc-types → dist/
quarto render ┘
```

### 4. Publish

Pushing to `main` triggers an automatic build and deploy via GitHub Actions. See the [tutorial](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) for details.

## Templates

The repository ships **34 practical templates** under `docs/templates/`. Copy the type you like, replace the content, and you are ready to go. See the [template catalog](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) for the full list.

| Format | Count | Examples |
|---|---|---|
| `.qmd` | 15 | Playbook / Runbook / API Reference / Design Doc / Proposal / FAQ / Research Note / Report |
| `.md` | 14 | Meeting Notes / ADR / Release Notes / Incident Report / Glossary / Cheatsheet / Comparison |
| `.adoc` | 5 | Playbook / API Reference / Meeting Notes / Cheatsheet |

## Documentation

For newcomers, reading in this order gives you the full picture.

1. [Tutorial](https://watanabe3tipapa.github.io/quarto-plus/docs/tutorial.html) — the pipeline at a glance
2. [Template catalog](https://watanabe3tipapa.github.io/quarto-plus/docs/templates/index.html) — practical templates
3. [DOM structure](https://watanabe3tipapa.github.io/quarto-plus/docs/dom-structure.html) — normalization rules for heading IDs, TOC, links, and images

Development notes are in [DEV-MEMO](DEV-MEMO.md).

## Contributing

Contributions are welcome. Before making major changes, please open an [issue](https://github.com/watanabe3tipapa/quarto-plus/issues) to share your plans first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Contact

GitHub: [https://github.com/watanabe3tipapa/quarto-plus](https://github.com/watanabe3tipapa/quarto-plus)

Published site: [https://watanabe3tipapa.github.io/quarto-plus/](https://watanabe3tipapa.github.io/quarto-plus/)

## License

Distributed under the MIT License — see the [LICENSE](LICENSE) file for details.
