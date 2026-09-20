# Cloud Publisher

Cloud Publisher converts repository-owned source folders into the existing
Catalog 2.2 and Manifest 2.1 website format. It never executes MATLAB.

The production workflow runs:

```bash
python3 -m publisher.build --repository-root .
```

The command validates every immediate child directory below `projects/`, builds
the complete output in a temporary directory, validates it, and only then safely
replaces `docs/content`. Existing V1 categories, projects, artifacts, translations,
and `defaultProject` remain unchanged.

V2 projects are managed only inside the `published-projects` category. Removing
a source folder is deliberately rejected; deletion requires a future explicit
workflow.
