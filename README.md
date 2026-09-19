# MATLAB Machine Learning Code Repository

This repository is a content-driven collection of independent MATLAB machine
learning cases. Its information architecture is:

```text
Category tree
    ↓
Independent case
    ↓
Case sections, MATLAB source, results, plots, and local documents
```

MATLAB produces static assets. The HTML/CSS/JavaScript application reads those
assets and presents them as a searchable repository. The browser never runs
MATLAB and there is no execution service, backend, or database.

```text
MATLAB case programs
    ↓
JSON data + PNG plots + copied source + optional local Markdown
    ↓
schema 2.2 catalog + independent case manifests
    ↓
Static repository browser
    ↓
GitHub Pages
```

## Repository capabilities

- Category-first navigation with multiple independent cases per category
- Four runnable cases: passenger flow, signal denoising, queue simulation, and
  heat diffusion
- Case-owned sections and stable hash deep links such as
  `#/project/passenger-flow/section/forecast`
- English base fields with adjacent Traditional Chinese `i18n.zh-Hant`
  overrides
- Content blocks for text, code, plots, metrics, tables, callouts, steps, and
  split layouts
- Manifest schema 2.1 support for local `markdown` artifacts and blocks
- Independent loading and failure isolation for each case and content block
- Responsive source viewers, plots, tables, category navigation, and case
  section navigation
- Shared MATLAB publishing helpers and a one-command `run_all` entry point
- Zero-dependency Node.js and Python contract tests
- GitHub Pages repository-subpath compatibility
- No React, Vue, npm package, CDN, remote content, backend, or database

## Repository structure

```text
matlab-web-demo/
├── README.md
├── AGENTS.md
├── tests/
│   ├── content-utils.test.js
│   ├── content-contract.test.js
│   ├── markdown.test.js
│   └── http_smoke.py
├── matlab/
│   ├── main.m
│   ├── generate_data.m
│   ├── generate_plots.m
│   ├── run_all.m
│   ├── demo_project_paths.m
│   ├── publish_project.m
│   ├── export_demo_figure.m
│   ├── style_demo_axes.m
│   ├── tests/validate_all.m
│   └── projects/
│       ├── signal_denoising/
│       ├── queue_simulation/
│       └── heat_diffusion/
└── docs/
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── content-utils.js
    │   ├── markdown.js
    │   └── app.js
    └── content/
        ├── README.md
        ├── catalog.json
        └── projects/
            ├── passenger-flow/
            ├── signal-denoising/
            ├── queue-simulation/
            └── heat-diffusion/
```

Each directory below `docs/content/projects/` is a self-contained published
case. It owns its manifest, results, plots, copied source, and optional Markdown
files. A case must not reach into another case directory.

## Quick start

### 1. Generate every case with MATLAB

From the repository root in the MATLAB Command Window:

```matlab
addpath('matlab');
run_all
```

Opening `matlab/run_all.m` in MATLAB and clicking **Run** performs the same
operation. `run_all` invokes the existing passenger-flow entry point followed by
the three independently named case entry points.

Generate one case independently with the matching source directory on the
MATLAB path:

```matlab
addpath('matlab');
main                                      % Passenger Flow Forecasting

addpath('matlab', 'matlab/projects/signal_denoising');
signal_denoising_main

addpath('matlab', 'matlab/projects/queue_simulation');
queue_simulation_main

addpath('matlab', 'matlab/projects/heat_diffusion');
heat_diffusion_main
```

Every entry point derives output paths from `mfilename('fullpath')`; published
paths do not depend on MATLAB's current working directory once the entry point
is callable.

Each run updates only that case:

```text
docs/content/projects/<project-id>/data/results.json
docs/content/projects/<project-id>/plots/*.png
docs/content/projects/<project-id>/code/*.m
docs/content/projects/<project-id>/manifest.json metadata
docs/content/catalog.json metadata
```

The publisher preserves the case manifest structure and updates `version` and
`lastUpdated`. It also updates the matching nested catalog entry without
changing category membership.

### 2. Preview the repository

Do not double-click `index.html`; browsers normally block JSON, MATLAB source,
and Markdown requests on `file://` URLs.

From the repository root:

```bash
python3 -m http.server 8000 --directory docs
```

Open [http://localhost:8000](http://localhost:8000).

Use **EN** or **繁中** in the top bar. The language is stored in the URL and
browser storage while the current case and section hash remain unchanged.

**Refresh Content** reloads files already published by MATLAB. It never starts
MATLAB or executes source code.

### 3. Deploy with GitHub Pages

1. Push the repository to GitHub's `main` branch.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Select branch **main** and folder **/docs**.
5. Click **Save**.

All resources use relative URLs, so deployment below
`https://username.github.io/repository-name/` requires no path changes.

### 4. Update existing case results

```text
Edit or run the MATLAB case
→ MATLAB refreshes that case's static assets and metadata
→ Preview locally
→ git add / commit / push
→ GitHub Pages redeploys /docs
```

Routine analysis updates do not require changes to `index.html`, `style.css`,
or `app.js`.

## Validation

The browser and content checks use only built-in Node.js and Python modules:

```bash
node --check docs/js/content-utils.js
node --check docs/js/app.js
node --test tests/*.test.js
python3 tests/http_smoke.py
```

MATLAB validation regenerates all cases, checks MATLAB source, parses every
result JSON file, and verifies every PNG:

```matlab
addpath('matlab');
run_all
run('matlab/tests/validate_all.m')
```

## Schema 2.2 content model

`docs/content/catalog.json` owns the category tree. Each category contains a
`projects` array; every project entry represents one independent case and points
to that case's manifest.

```text
catalog.categories[]
└── category.projects[]
    └── projects/<project-id>/manifest.json
        └── sections[].blocks[]
```

The category controls discovery and grouping. The manifest controls only one
case: its sections, artifacts, content order, and localized metadata. Section
navigation never crosses case boundaries.

See `docs/content/README.md` for the complete schema, block reference, and
Markdown security rules.

## Adding repository content

### Add a category

Add a stable kebab-case category object to `catalog.categories`. Put its English
title and description in the base fields and Traditional Chinese overrides in
`i18n.zh-Hant`. Move or add case entries within its `projects` array.

### Add an independent case

1. Create `docs/content/projects/<project-id>/` with its own manifest and assets.
2. Register the case inside exactly one `catalog.categories[].projects[]` array.
3. Give the MATLAB case a uniquely named entry point that uses the shared
   publisher.
4. Keep every artifact path inside that case directory.

The case then appears in its category without adding an HTML page.

### Add or reorder a case section

Add or move an object in the manifest's `sections` array. Array order controls
the case-section outline. Reorder `blocks` to change the content sequence.

### Add MATLAB source, data, or a plot

1. Put the generated file below the case's `code`, `data`, or `plots` directory.
2. Register it once in the manifest artifact registry with a stable ID.
3. Reference the artifact ID from the matching content block.
4. Give every plot meaningful English and Traditional Chinese alternative text.

### Add local Markdown

Register a case-local `.md` file as a `markdown` artifact and reference it from
a `markdown` block. Markdown is restricted to the safe subset documented in
`docs/content/README.md`: no raw HTML, remote URLs, remote images, scripts,
embedded frames, or parent-directory paths.

## Error isolation

- A catalog failure shows a repository-level startup error.
- A category or case error does not invalidate unrelated cases.
- A manifest failure is isolated to the selected case.
- A malformed block becomes an error card while later blocks continue.
- A missing PNG affects only that plot.
- A missing `.m` or `.md` file affects only its viewer.
- JSON and Markdown text must never be injected as untrusted HTML.

## Troubleshooting

### The browser cannot load repository content

Confirm that `docs/content/catalog.json` is valid schema 2.2 JSON and preview
through an HTTP server.

### A plot, source file, result, or Markdown document is unavailable

Run `matlab/run_all.m` or the relevant case entry point, then compare the
artifact path in the case manifest with the generated filename, including case.

### GitHub Pages still shows an older run

Wait for the Pages deployment to finish and click **Refresh Content**. The case
manifest version is appended to source and image requests.
