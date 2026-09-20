# How to publish a project

Create one folder here whose name uses lowercase kebab-case, for example:

```text
projects/passenger-flow-forecasting/
├── README.md
├── main.m
└── result.png
```

The project folder must contain:

- `README.md` with a first-level `# Project Name` heading
- at least one non-empty `.m` file
- at least one valid `.png`, `.jpg`, or `.jpeg` image

Files are displayed in natural filename order. Upload the folder to GitHub and
commit the change. GitHub Actions validates it, generates the website content,
and publishes GitHub Pages. Do not edit `docs/content` by hand.
