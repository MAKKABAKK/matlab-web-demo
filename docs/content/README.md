# Schema 2.2 content contract

The static repository reads two configuration levels:

1. `catalog.json` declares categories and the independent cases inside each
   category.
2. Each case owns one `manifest.json` that declares its artifacts, sections, and
   ordered content blocks.

The hierarchy is always:

```text
category → independent case → case section
```

A category is an index grouping. A case is the unit of publication and failure
isolation. A section belongs to one case and is never a child category.

All paths are relative to the JSON file that declares them. Domain-root paths,
cross-origin URLs, backslash paths, encoded traversal, and parent-directory
segments are invalid because the site must work below a GitHub Pages repository
path.

## Stable IDs

Category, case, section, and artifact IDs must:

- use lowercase letters, numbers, and hyphens;
- remain stable when titles, languages, or filenames change;
- be unique within their declared scope.

The technical route retains `project` for backward-compatible links even though
the user-facing object is an independent case:

```text
#/project/passenger-flow/section/data-generation
```

## Catalog

Schema 2.2 replaces the flat project list with
`catalog.categories[].projects[]`.

```json
{
  "schemaVersion": "2.2",
  "siteTitle": "MATLAB Machine Learning Code Repository",
  "localization": {
    "defaultLocale": "en",
    "supportedLocales": ["en", "zh-Hant"]
  },
  "i18n": {
    "zh-Hant": {
      "siteTitle": "MATLAB 機器學習程式碼案例庫"
    }
  },
  "defaultProject": "passenger-flow",
  "categories": [
    {
      "id": "predictive-modeling",
      "title": "Predictive Modeling",
      "description": "Forecasting and model evaluation cases.",
      "i18n": {
        "zh-Hant": {
          "title": "預測建模",
          "description": "預測與模型評估案例。"
        }
      },
      "projects": [
        {
          "id": "passenger-flow",
          "title": "Passenger Flow Forecasting",
          "description": "A self-contained forecasting case.",
          "topic": "Time series · Forecasting",
          "manifest": "projects/passenger-flow/manifest.json",
          "lastUpdated": "2026-09-17 00:00:00",
          "i18n": {
            "zh-Hant": {
              "title": "客流量預測",
              "description": "獨立的客流預測案例。",
              "topic": "時間序列 · 預測"
            }
          }
        }
      ]
    }
  ]
}
```

Catalog rules:

- `categories` must be a non-empty array with unique category IDs.
- Each category must contain a non-empty `projects` array.
- A case ID may occur in exactly one category.
- `defaultProject` must identify exactly one case in the nested categories.
- Each manifest path must remain below `docs/content/`.
- Category and case order in the arrays controls navigation order.

## Independent case manifest

The schema 2.2 catalog points to independent case manifests. For compatibility
with the current renderer, each manifest retains `schemaVersion: "2.1"` and must
match its catalog case ID. Moving discovery into categories does not change the
manifest's sections or artifact registry.

```json
{
  "schemaVersion": "2.1",
  "id": "passenger-flow",
  "title": "Passenger Flow Forecasting",
  "eyebrow": "FORECASTING CASE",
  "description": "Generate data, evaluate models, and inspect outputs.",
  "version": "20260917-001730",
  "lastUpdated": "2026-09-17 00:17:30",
  "artifacts": [],
  "sections": []
}
```

Manifest rules:

- `artifacts` is the case-local resource registry.
- `sections` is a non-empty ordered array.
- Every referenced artifact must be declared in the same manifest.
- Artifact files must remain inside the same case directory.
- A manifest must not reference another case's data, plots, source, or Markdown.
- One case failure must not prevent another case from loading.

## English and Traditional Chinese

English remains in each object's base fields. An adjacent `i18n.zh-Hant` object
overrides only user-visible fields that need Traditional Chinese.

```json
{
  "id": "overview",
  "title": "Case Overview",
  "shortTitle": "Overview",
  "summary": "Inspect the latest result.",
  "i18n": {
    "zh-Hant": {
      "title": "案例概覽",
      "shortTitle": "概覽",
      "summary": "檢視最新結果。"
    }
  }
}
```

The adjacent override applies to catalog headings, category entries, case
entries, manifest headers, artifacts, sections, blocks, metric items, table
columns, and step items. Arrays such as `paragraphs` are replaced as a whole.
If one Traditional Chinese field is absent, only that field falls back to
English.

Stable IDs, block types, artifact kinds, file paths, data paths, data keys,
formats, tones, ratios, and derivation rules must not be translated.
For a localized Markdown document, keep the English path in `file` and declare
the Traditional Chinese path explicitly in `fileByLocale.zh-Hant`; both files
must remain inside the same case directory.

Supported URL forms preserve the case-section hash:

```text
?lang=en#/project/passenger-flow/section/overview
?lang=zh-Hant#/project/passenger-flow/section/overview
```

MATLAB-generated PNG text remains English. The surrounding label, caption, and
alternative text follow the selected web language.

## Artifact registry

Every external file is registered once and referenced by a stable artifact ID.

```json
{
  "id": "plot-forecast",
  "kind": "plot",
  "file": "plots/forecast.png",
  "label": "Passenger Flow Forecast",
  "alt": "Line chart comparing actual and forecast passenger flow",
  "caption": "Actual and forecast values over time.",
  "i18n": {
    "zh-Hant": {
      "label": "客流量預測",
      "alt": "比較實際與預測客流量的折線圖",
      "caption": "實際值與預測值的時間序列比較。"
    }
  }
}
```

Manifest schema 2.1 artifact kinds:

- `json`
- `matlab-code`
- `plot`
- `markdown`

All plot artifacts require non-empty English and Traditional Chinese
alternative text. A Markdown artifact must reference a case-local `.md` file.

## Block reference

### `text`

```json
{
  "type": "text",
  "eyebrow": "CASE GOAL",
  "title": "What this function does",
  "paragraphs": ["First paragraph.", "Second paragraph."]
}
```

### `code`

```json
{
  "type": "code",
  "artifact": "code-main",
  "title": "Case entry point"
}
```

### `plot`

```json
{
  "type": "plot",
  "artifact": "plot-forecast"
}
```

### `metrics`

Metric values can be read from a JSON artifact or derived by selecting the
minimum item in an array.

```json
{
  "type": "metrics",
  "source": "results",
  "items": [
    {
      "label": "RMSE",
      "path": "metrics.RMSE",
      "format": "number:2",
      "detail": "Root mean squared error",
      "tone": "cyan"
    }
  ]
}
```

Available metric tones are `blue`, `cyan`, `violet`, and `green`.

### `table`

```json
{
  "type": "table",
  "title": "Model scores",
  "source": "results",
  "path": "models",
  "highlightMin": "rmse",
  "columns": [
    { "label": "Model", "key": "name" },
    { "label": "RMSE", "key": "rmse", "format": "number:2" }
  ]
}
```

### `callout`

```json
{
  "type": "callout",
  "tone": "note",
  "title": "Implementation note",
  "content": "Explain why this case uses a transparent baseline."
}
```

Available callout tones are `info`, `note`, and `warning`.

### `steps`

```json
{
  "type": "steps",
  "title": "Execution flow",
  "items": [
    { "title": "Generate", "content": "Create deterministic input data." },
    { "title": "Evaluate", "content": "Calculate the published metrics." }
  ]
}
```

### `split`

`split` accepts exactly two non-split child blocks. Supported ratios are `1:1`,
`3:2`, and `2:3`. It collapses to one column on smaller screens.

```json
{
  "type": "split",
  "ratio": "1:1",
  "blocks": [
    { "type": "code", "artifact": "code-main" },
    { "type": "plot", "artifact": "plot-forecast" }
  ]
}
```

### `markdown`

Manifest schema 2.1 supports a case-local Markdown artifact and block:

```json
{
  "id": "model-notes",
  "kind": "markdown",
  "file": "docs/model-notes.md",
  "fileByLocale": {
    "zh-Hant": "docs/model-notes.zh-Hant.md"
  },
  "label": "Model notes",
  "i18n": {
    "zh-Hant": {
      "label": "模型說明"
    }
  }
}
```

```json
{
  "type": "markdown",
  "artifact": "model-notes",
  "title": "Model notes"
}
```

The safe Markdown subset contains:

- paragraphs, with wrapped source lines joined as prose;
- level 1–4 headings;
- ordered and unordered lists;
- block quotes;
- inline code;
- fenced code blocks, with an optional language label.

Markdown must not contain or render:

- raw HTML;
- scripts, styles, forms, embedded frames, or event attributes;
- remote links, remote images, protocol-relative URLs, or data URLs;
- Markdown images;
- absolute paths, backslashes, encoded traversal, or `..` segments.

Markdown link and image syntax is not part of the subset and is rendered as
ordinary text. Authors must not use it to load local or remote resources.

The renderer must build DOM nodes from parsed tokens and assign text through
`textContent`; it must not insert Markdown output through unsanitized
`innerHTML`. A missing or invalid Markdown file becomes a block-level error and
does not invalidate the rest of the case.

## General restrictions

Arbitrary HTML, JavaScript, CSS, absolute URLs, parent-directory paths, remote
resources, and nested split blocks are unsupported. These rules keep every case
portable, static, and isolated.
