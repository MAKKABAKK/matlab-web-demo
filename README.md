# MATLAB Machine Learning Code Repository

This repository is a static, content-driven collection of independent MATLAB
code cases. The website reads Catalog 2.2 and Manifest 2.1 files; it never runs
MATLAB and has no backend or database.

For V2, `projects/` is the source of truth for new and updated projects. A
maintainer uploads an already-written `.m` file and already-generated image;
GitHub Actions validates the folder, builds the existing website contract, runs
the tests, and deploys GitHub Pages.

```text
projects/<project-id>/
    ↓ Cloud Publisher (no MATLAB execution)
docs/content/ Catalog 2.2 + Manifest 2.1
    ↓
Static repository browser
    ↓
GitHub Pages
```

The four V1 projects and the MATLAB publishing pipeline remain in the repository
as legacy, backward-compatible content. V2 does not modify or invoke them.

## HOW TO PUBLISH A PROJECT

No local command, Git client, MATLAB installation, JSON editing, or preview is
required.

1. Create one project folder. Its name must use lowercase ASCII letters,
   numbers, and single hyphens, for example `passenger-flow-forecasting`.
2. Add `README.md`. Put the project name in the first `# Heading`; put the
   optional description below it.
3. Add one or more non-empty MATLAB `.m` files.
4. Add one or more valid `.png`, `.jpg`, or `.jpeg` images.
5. In GitHub, open the repository's `projects/` directory and upload the project
   folder and its files.
6. Commit the changes.
7. Wait for the **Publish projects and GitHub Pages** workflow to pass.
8. Open GitHub Pages and select the project under **Published Projects**.

Example:

```text
projects/
└── passenger-flow-forecasting/
    ├── README.md
    ├── main.m
    ├── forecast.m
    ├── result.png
    └── comparison.jpg
```

```markdown
# Passenger Flow Forecasting

A MATLAB passenger flow forecasting project.
```

Do not create or edit manifest/catalog JSON for a V2 project. Do not edit its
generated copy under `docs/content/`.

## Publishing rules

- The folder name is the permanent project ID. Changing the README title does
  not change identity.
- Every immediate project folder is scanned one level deep; nested directories
  and symlinks are rejected.
- Hidden files and unsupported regular files are ignored.
- A project requires `README.md`, at least one non-empty UTF-8 `.m` file, and at
  least one structurally valid PNG/JPG/JPEG image whose extension matches its
  signature.
- Code files and images are displayed in case-insensitive natural filename
  order (`file2` before `file10`).
- Image label, alternative text, and caption are derived from the filename.
- New projects enter the single `published-projects` category.
- Re-uploading the same folder updates that project. It never creates a suffixed
  duplicate ID.
- Deleting a source folder does not delete the published project. The build
  fails and asks for explicit deletion handling.
- V2 content uses English base fields and may omit `i18n.zh-Hant`; the existing
  runtime falls back field-by-field to English. Existing V1 translations remain
  untouched.

## Repository structure

```text
matlab-web-demo/
├── .github/workflows/publish-pages.yml
├── projects/                    # V2 source of truth
├── publisher/                   # deterministic standard-library builder
├── tests/
├── docs/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── content-utils.js
│   │   ├── markdown.js
│   │   ├── navigation-utils.js
│   │   └── app.js
│   └── content/                 # generated V2 + preserved V1 content
└── matlab/                      # frozen/legacy V1 publishing pipeline
```

## Cloud Publisher behavior

`publisher.build` reads the complete `projects/` tree, then works on a temporary
copy of `docs/content`. It preserves all V1 categories, projects, order,
translations, artifacts, and `defaultProject`; creates or reuses **Published
Projects**; copies source files and images; generates two sections (`Overview`
and `Source Code`); validates the complete staged website; and only then safely
replaces `docs/content`.

If any source or generated file is invalid, the real published content is not
changed. Output versions are content hashes. `lastUpdated` changes only when a
project's source content changes, so repeated builds are deterministic.

The production command is documented for developers and CI only:

```bash
python3 -m publisher.build --repository-root .
```

Maintainers publishing through GitHub do not run it.

## GitHub Actions and Pages

The workflow builds and tests every relevant change. On a successful push to
`main`, it uploads the tested `docs/` directory as a GitHub Pages artifact. It
also commits only generated `docs/content/catalog.json` and
`docs/content/projects/` changes back to `main`, using `GITHUB_TOKEN`, a clear
`[skip ci]` message, and a race check. It never force-pushes and never stores a
PAT. Test failures cause neither a generated-content commit nor a deployment.

GitHub Pages must use **GitHub Actions** as its source after this workflow is
merged. Repository-relative URLs continue to support
`https://username.github.io/repository-name/`.

## Website behavior

- The sidebar is generated from `catalog.categories[].projects[]`; no category
  or project names are hardcoded in HTML or JavaScript.
- Multiple categories can remain expanded. The preference is stored locally,
  while a deep-linked active project is always made visible.
- Case section counts come from each project's manifest and share a request
  cache with normal case loading. One failed manifest does not break the tree.
- Hash routes remain `#/project/<project-id>/section/<section-id>`.
- English and Traditional Chinese switching, existing localized files, content
  blocks, section navigation, and repository-subpath URLs remain compatible.

## Developer validation

The implementation uses the Python and Node.js standard libraries only:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 -m publisher.build --repository-root .
node --check docs/js/content-utils.js
node --check docs/js/markdown.js
node --check docs/js/navigation-utils.js
node --check docs/js/app.js
node --test tests/*.test.js
python3 tests/http_smoke.py
```

See `publisher/README.md` for builder details and `docs/content/README.md` for
the preserved Catalog 2.2 / Manifest 2.1 contract.

## Legacy V1 workflow (optional)

The existing `matlab/publish_project.m`, `matlab/run_all.m`, V1 projects,
results, manifests, and artifacts are retained but are not part of normal V2
publishing. They must not be removed or invoked by the Cloud Publisher.

For V1 maintenance only, an environment with MATLAB can still run:

```matlab
addpath('matlab');
run_all
run('matlab/tests/validate_all.m')
```

The browser never executes MATLAB in either version.

## Troubleshooting

- **Workflow says the README has no H1:** add a non-empty `# Project Name`
  heading.
- **Invalid project ID:** rename the folder to lowercase ASCII kebab-case.
- **Invalid image:** export a valid PNG or JPEG and keep the matching extension.
- **Source project missing:** restore the accidentally removed source folder;
  automatic deletion is intentionally disabled.
- **Pages shows an older version:** wait for the workflow to finish, then use
  **Refresh Content** on the website.
