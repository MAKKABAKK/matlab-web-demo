const content = window.MatlabCaseRepositoryContent;
const markdown = window.MatlabRepositoryMarkdown;
const navigation = window.MatlabRepositoryNavigation;
if (!content || !markdown || !navigation) throw new Error("Repository utilities failed to load.");

function readStoredLocale() {
  try {
    return localStorage.getItem(content.STORAGE_KEY);
  } catch {
    return null;
  }
}

function readExpandedCategories() {
  try {
    return localStorage.getItem(navigation.STORAGE_KEY);
  } catch {
    return null;
  }
}

const state = {
  catalog: null,
  catalogUrl: null,
  project: null,
  category: null,
  manifest: null,
  manifestBase: null,
  section: null,
  timestamp: Date.now(),
  locale: content.selectLocale({
    search: window.location.search,
    storedLocale: readStoredLocale(),
    browserLocales: navigator.languages || [navigator.language]
  }),
  navigationToken: 0,
  renderToken: 0,
  treeCountToken: 0,
  expandedCategories: new Set(),
  expansionInitialized: false,
  sectionCounts: new Map(),
  sectionCountFailures: new Set(),
  sectionCountPending: new Map(),
  manifestCache: navigation.createAsyncCache(),
  dataCache: new Map()
};

const elements = {
  categoryTree: document.querySelector("#category-tree"),
  caseCount: document.querySelector("#case-count"),
  activeCaseLabel: document.querySelector("#active-case-label"),
  sectionProgress: document.querySelector("#section-progress"),
  sectionNav: document.querySelector("#section-nav"),
  projectEyebrow: document.querySelector("#project-eyebrow"),
  projectTitle: document.querySelector("#project-title"),
  projectDescription: document.querySelector("#project-description"),
  refreshButton: document.querySelector("#refresh-button"),
  appError: document.querySelector("#app-error"),
  appErrorTitle: document.querySelector("#app-error-title"),
  appErrorMessage: document.querySelector("#app-error-message"),
  loadingState: document.querySelector("#loading-state"),
  caseView: document.querySelector("#case-view"),
  sectionIndex: document.querySelector("#section-index"),
  sectionTitle: document.querySelector("#section-title"),
  sectionSummary: document.querySelector("#section-summary"),
  lastUpdated: document.querySelector("#last-updated"),
  contentVersion: document.querySelector("#content-version"),
  contentBlocks: document.querySelector("#content-blocks"),
  previousSection: document.querySelector("#previous-section"),
  nextSection: document.querySelector("#next-section")
};

function field(record, name) {
  return content.localizedField(record, name, state.locale);
}

function t(key, params) {
  return content.translateMessage(state.locale, key, params);
}

function applyShellTranslations() {
  document.documentElement.lang = state.locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll(".language-option").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.locale === state.locale));
  });
}

function rememberLocale(locale) {
  try {
    localStorage.setItem(content.STORAGE_KEY, locale);
  } catch {
    // 隱私模式可能停用 localStorage；目前頁面的語言仍然有效。
  }
}

function rememberExpandedCategories() {
  try {
    localStorage.setItem(
      navigation.STORAGE_KEY,
      navigation.serializeExpandedCategories(state.expandedCategories)
    );
  } catch {
    // 隱私模式可能停用 localStorage；目前頁面的展開狀態仍然有效。
  }
}

function ensureActiveCategory(categoryId) {
  const next = navigation.ensureCategoryExpanded(state.expandedCategories, categoryId);
  if (next.size !== state.expandedCategories.size) {
    state.expandedCategories = next;
    rememberExpandedCategories();
  }
}

function setLocale(locale) {
  const normalized = content.canonicalizeLocale(locale) || content.DEFAULT_LOCALE;
  state.locale = normalized;
  rememberLocale(normalized);
  history.replaceState(null, "", content.urlWithLocale(window.location.href, normalized));
  applyShellTranslations();
  if (state.section) renderCurrentSection(false, true);
  else if (state.catalog) populateRepositoryTree();
}

function showLoading(message) {
  elements.loadingState.querySelector("p").textContent = message || t("loading.case");
  elements.loadingState.hidden = false;
  elements.caseView.hidden = true;
  elements.appError.hidden = true;
}

function showGlobalError(title, message) {
  elements.appErrorTitle.textContent = title;
  elements.appErrorMessage.textContent = message;
  elements.appError.hidden = false;
  elements.loadingState.hidden = true;
  elements.caseView.hidden = true;
}

function validateCatalog(catalog) {
  return content.validateCatalog(catalog);
}

function validateManifest(manifest, expectedId) {
  return content.validateManifest(manifest, expectedId);
}

function resolveRelativeUrl(baseUrl, relativePath) {
  return content.resolveRelativeUrl(baseUrl, relativePath);
}

async function fetchJson(url) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("t", String(state.timestamp));
  const response = await fetch(requestUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${requestUrl.pathname}`);
  return response.json();
}

async function fetchText(url) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("v", state.manifest?.version || String(state.timestamp));
  const response = await fetch(requestUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${requestUrl.pathname}`);
  return response.text();
}

function parseRoute() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "project" && parts[1]) {
    return { projectId: parts[1], sectionId: parts[2] === "section" ? parts[3] : null };
  }
  return { projectId: null, sectionId: null };
}

function routeFor(projectId, sectionId) {
  return `#/project/${encodeURIComponent(projectId)}/section/${encodeURIComponent(sectionId)}`;
}

function setRoute(projectId, sectionId, replace = false) {
  const hash = routeFor(projectId, sectionId);
  if (replace) {
    history.replaceState(null, "", hash);
    return;
  }
  if (window.location.hash !== hash) window.location.hash = hash;
}

function projectRoute(projectId) {
  return `#/project/${encodeURIComponent(projectId)}`;
}

function loadProjectManifest(project) {
  return state.manifestCache.get(project.id, async () => {
    const manifestUrl = resolveRelativeUrl(state.catalogUrl, project.manifest);
    const manifest = validateManifest(await fetchJson(manifestUrl), project.id);
    return { manifest, manifestUrl };
  });
}

async function hydrateSectionCounts() {
  const projects = content.catalogProjects(state.catalog).filter((project) => (
    !state.sectionCounts.has(project.id)
    && !state.sectionCountFailures.has(project.id)
    && !state.sectionCountPending.has(project.id)
  ));
  if (!projects.length) return;
  const treeCountToken = ++state.treeCountToken;
  const batch = Symbol("section-count-batch");
  projects.forEach((project) => state.sectionCountPending.set(project.id, batch));

  const results = await Promise.allSettled(projects.map(async (project) => {
    const { manifest } = await loadProjectManifest(project);
    return { projectId: project.id, count: manifest.sections.length };
  }));
  projects.forEach((project) => {
    if (state.sectionCountPending.get(project.id) === batch) state.sectionCountPending.delete(project.id);
  });
  if (treeCountToken !== state.treeCountToken) return;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      state.sectionCounts.set(result.value.projectId, result.value.count);
    } else {
      state.sectionCountFailures.add(projects[index].id);
      console.warn(`Section count unavailable for ${projects[index].id}:`, result.reason);
    }
  });
  populateRepositoryTree(false);
}

function populateRepositoryTree(loadCounts = true) {
  const projects = content.catalogProjects(state.catalog);
  elements.caseCount.textContent = t("repository.caseCount", { count: projects.length });

  const groups = state.catalog.categories.map((category) => {
    const group = createElement("section", "category-group");
    const isExpanded = state.expandedCategories.has(category.id);

    const toggle = createElement("button", "category-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute("aria-controls", `category-projects-${category.id}`);
    toggle.append(
      createElement("span", "category-chevron", "›"),
      createElement("strong", "", field(category, "title")),
      createElement("small", "", String(category.projects.length))
    );

    const list = createElement("div", "category-projects");
    list.id = `category-projects-${category.id}`;
    list.hidden = !isExpanded;
    category.projects.forEach((project) => {
      const link = createElement("a", "case-link");
      link.href = projectRoute(project.id);
      link.dataset.projectId = project.id;
      link.append(
        createElement("span", "case-link-mark", "M"),
        createElement("span", "case-link-copy")
      );
      const copy = link.querySelector(".case-link-copy");
      const sectionCount = state.sectionCounts.get(project.id);
      copy.append(
        createElement("strong", "", field(project, "title")),
        createElement("small", "", sectionCount == null ? "" : t("sections.count", { count: sectionCount }))
      );
      if (state.project?.id === project.id) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      list.append(link);
    });

    toggle.addEventListener("click", () => {
      const nextExpanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(nextExpanded));
      list.hidden = !nextExpanded;
      state.expandedCategories = navigation.setCategoryExpanded(
        state.expandedCategories,
        category.id,
        nextExpanded
      );
      rememberExpandedCategories();
    });
    group.append(toggle, list);
    return group;
  });
  elements.categoryTree.replaceChildren(...groups);
  if (loadCounts) void hydrateSectionCounts();
}

function populateSectionNav() {
  const links = state.manifest.sections.map((section, index) => {
    const link = document.createElement("a");
    link.className = "nav-item";
    link.href = routeFor(state.project.id, section.id);
    if (section.id === state.section.id) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("strong");
    title.textContent = field(section, "shortTitle") || field(section, "title");
    link.append(number, title);
    return link;
  });
  elements.sectionNav.replaceChildren(...links);
}

function getArtifact(artifactId, expectedKind) {
  const artifact = state.manifest.artifactMap[artifactId];
  if (!artifact) throw new Error(`Unknown artifact: ${artifactId}`);
  if (expectedKind && artifact.kind !== expectedKind) {
    throw new Error(`Artifact ${artifactId} must be ${expectedKind}.`);
  }
  return artifact;
}

function artifactFile(artifact) {
  return artifact.fileByLocale?.[state.locale] || artifact.file;
}

function artifactUrl(artifact) {
  return resolveRelativeUrl(state.manifestBase, artifactFile(artifact));
}

function getPathValue(source, path) {
  if (!path) return source;
  return String(path).split(".").reduce((value, key) => value?.[key], source);
}

function formatValue(value, format) {
  if (!format) return value == null ? "—" : String(value);
  const [type, precisionText] = format.split(":");
  if (type === "number") {
    const number = Number(value);
    const precision = Math.min(Math.max(Number(precisionText) || 0, 0), 6);
    return Number.isFinite(number) ? number.toFixed(precision) : "—";
  }
  return value == null ? "—" : String(value);
}

function formatTableValue(value, column) {
  const valueLabels = field(column, "valueLabels");
  if (valueLabels && typeof valueLabels === "object" && !Array.isArray(valueLabels)) {
    const key = String(value);
    if (Object.prototype.hasOwnProperty.call(valueLabels, key)) return valueLabels[key];
  }
  return formatValue(value, column.format);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createBlockError(message) {
  const card = createElement("article", "block-error");
  card.append(
    createElement("strong", "", t("block.errorTitle")),
    createElement("p", "", message)
  );
  return card;
}

function createBlockHeader(block, fallbackTitle) {
  const header = createElement("header", "block-heading");
  const eyebrow = field(block, "eyebrow");
  if (eyebrow) header.append(createElement("p", "block-eyebrow", eyebrow));
  const title = field(block, "title") || fallbackTitle;
  if (title) header.append(createElement("h3", "", title));
  const description = field(block, "description");
  if (description) header.append(createElement("p", "block-description", description));
  return header;
}

function loadDataArtifact(artifactId) {
  const cacheKey = `${state.manifest.id}:${state.manifest.version}:${state.locale}:${artifactId}`;
  if (!state.dataCache.has(cacheKey)) {
    const artifact = getArtifact(artifactId, "json");
    state.dataCache.set(cacheKey, fetchJson(artifactUrl(artifact)));
  }
  return state.dataCache.get(cacheKey);
}

function renderTextBlock(block) {
  const card = createElement("article", "content-card text-block");
  card.append(createBlockHeader(block));
  const localizedParagraphs = field(block, "paragraphs");
  const paragraphs = Array.isArray(localizedParagraphs)
    ? localizedParagraphs
    : [field(block, "content")].filter(Boolean);
  paragraphs.forEach((paragraph) => card.append(createElement("p", "", paragraph)));
  return card;
}

function renderMarkdownBlock(block, renderToken) {
  const artifact = getArtifact(block.artifact, "markdown");
  const card = createElement("article", "content-card markdown-block");
  card.append(createBlockHeader(block, field(artifact, "label")));
  const status = createElement("p", "block-loading", t("markdown.loading"));
  card.append(status);

  fetchText(artifactUrl(artifact)).then((source) => {
    if (renderToken !== state.renderToken) return;
    status.replaceWith(markdown.renderMarkdown(source));
  }).catch((error) => {
    if (renderToken !== state.renderToken) return;
    console.error("Markdown source failed:", error);
    status.replaceWith(createBlockError(t("markdown.unavailable", {
      file: artifactFile(artifact),
      reason: error.message
    })));
  });
  return card;
}

function renderPlotBlock(block) {
  const artifact = getArtifact(block.artifact, "plot");
  const alt = field(artifact, "alt");
  if (!alt) throw new Error(`Plot ${block.artifact} needs alternative text.`);

  const figure = createElement("figure", "content-card plot-block");
  figure.append(createBlockHeader(block, field(artifact, "label")));

  const frame = createElement("div", "plot-frame");
  const image = document.createElement("img");
  const imageUrl = artifactUrl(artifact);
  imageUrl.searchParams.set("v", state.manifest.version || String(state.timestamp));
  image.src = imageUrl.href;
  image.alt = alt;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    frame.classList.add("asset-error");
    frame.replaceChildren(
      createElement("strong", "", t("plot.unavailable")),
      createElement("span", "", t("plot.hint", { file: artifactFile(artifact) }))
    );
  });
  frame.append(image);
  figure.append(frame);
  const caption = field(block, "caption") || field(artifact, "caption");
  if (caption) figure.append(createElement("figcaption", "", caption));
  return figure;
}

function renderCodeBlock(block, renderToken) {
  const artifact = getArtifact(block.artifact, "matlab-code");
  const card = createElement("article", "content-card code-block");
  card.append(createBlockHeader(block));

  const codePanel = createElement("div", "code-panel");
  const toolbar = createElement("div", "code-toolbar");
  const filename = createElement("span", "code-filename");
  filename.append(createElement("i", ""), document.createTextNode(field(artifact, "label") || artifact.file));
  const copyButton = createElement("button", "copy-button", t("copy.ready"));
  copyButton.type = "button";
  copyButton.disabled = true;
  toolbar.append(filename, copyButton);

  const pre = document.createElement("pre");
  const code = createElement("code", "", t("code.loading"));
  pre.append(code);
  codePanel.append(toolbar, pre);
  card.append(codePanel);

  fetchText(artifactUrl(artifact)).then((source) => {
    if (renderToken !== state.renderToken) return;
    code.textContent = source;
    copyButton.disabled = false;
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(source);
        copyButton.textContent = t("copy.success");
      } catch {
        copyButton.textContent = t("copy.failure");
      }
      setTimeout(() => { copyButton.textContent = t("copy.ready"); }, 1500);
    });
  }).catch((error) => {
    if (renderToken !== state.renderToken) return;
    code.textContent = t("code.unavailable", { file: artifactFile(artifact), reason: error.message });
    codePanel.classList.add("code-error");
  });
  return card;
}

function resolveMetric(item, data) {
  if (item.derive?.type === "min") {
    const rows = getPathValue(data, item.derive.path);
    if (!Array.isArray(rows) || !rows.length) {
      return { display: "—", detail: field(item, "detail") || t("metric.noData") };
    }
    const validRows = rows.filter((row) => Number.isFinite(Number(row[item.derive.valueKey])));
    if (!validRows.length) return { display: "—", detail: field(item, "detail") || t("metric.noData") };
    const best = validRows.reduce((current, row) => Number(row[item.derive.valueKey]) < Number(current[item.derive.valueKey]) ? row : current);
    const value = formatValue(best[item.derive.valueKey], item.format);
    const detailTemplate = field(item, "detailTemplate");
    return {
      display: String(best[item.derive.labelKey] ?? "—"),
      detail: detailTemplate ? detailTemplate.replace("{value}", value) : field(item, "detail") || value
    };
  }
  return { display: formatValue(getPathValue(data, item.path), item.format), detail: field(item, "detail") || "" };
}

function renderMetricsBlock(block, renderToken) {
  const grid = createElement("section", "metrics-grid");
  const cards = (block.items || []).map((item) => {
    const card = createElement("article", "metric-card loading");
    card.dataset.tone = item.tone || "blue";
    card.append(
      createElement("p", "metric-label", field(item, "label") || t("metric.fallback")),
      createElement("strong", "metric-value", "—"),
      createElement("span", "metric-detail", t("metric.loading"))
    );
    grid.append(card);
    return { card, item };
  });

  loadDataArtifact(block.source).then((data) => {
    if (renderToken !== state.renderToken) return;
    cards.forEach(({ card, item }) => {
      const metric = resolveMetric(item, data);
      card.querySelector(".metric-value").textContent = metric.display;
      card.querySelector(".metric-detail").textContent = metric.detail;
      card.classList.remove("loading");
    });
  }).catch((error) => {
    if (renderToken !== state.renderToken) return;
    console.error("Metrics source failed:", error);
    grid.replaceChildren(createBlockError(t("block.metricsSource")));
  });
  return grid;
}

function renderTableBlock(block, renderToken) {
  const card = createElement("article", "content-card table-block");
  card.append(createBlockHeader(block));
  const status = createElement("p", "block-loading", t("table.loading"));
  card.append(status);

  loadDataArtifact(block.source).then((data) => {
    if (renderToken !== state.renderToken) return;
    const rows = getPathValue(data, block.path);
    if (!Array.isArray(rows)) throw new Error(t("table.invalidRows"));
    const columns = Array.isArray(block.columns) ? block.columns : [];
    if (!columns.length) throw new Error(t("table.noColumns"));

    const tableWrap = createElement("div", "table-wrap");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    columns.forEach((column) => {
      const heading = createElement("th", "", field(column, "label") || column.key);
      heading.scope = "col";
      headingRow.append(heading);
    });
    thead.append(headingRow);

    const tbody = document.createElement("tbody");
    const numericValues = block.highlightMin
      ? rows.map((row) => Number(row[block.highlightMin])).filter(Number.isFinite)
      : [];
    const minimum = numericValues.length ? Math.min(...numericValues) : null;
    rows.forEach((row) => {
      const tableRow = document.createElement("tr");
      if (minimum !== null && Number(row[block.highlightMin]) === minimum) tableRow.classList.add("best-row");
      columns.forEach((column, index) => {
        const cell = createElement(index === 0 ? "th" : "td", "", formatTableValue(row[column.key], column));
        if (index === 0) cell.scope = "row";
        tableRow.append(cell);
      });
      tbody.append(tableRow);
    });
    table.append(thead, tbody);
    tableWrap.append(table);
    status.replaceWith(tableWrap);
  }).catch((error) => {
    if (renderToken !== state.renderToken) return;
    console.error("Table source failed:", error);
    status.replaceWith(createBlockError(t("block.tableSource")));
  });
  return card;
}

function renderCalloutBlock(block) {
  const tones = new Set(["info", "note", "warning"]);
  const card = createElement("aside", `callout-block ${tones.has(block.tone) ? block.tone : "info"}`);
  card.append(
    createElement("span", "callout-mark", block.tone === "warning" ? "!" : "i"),
    createElement("div", "callout-copy")
  );
  const copy = card.querySelector(".callout-copy");
  copy.append(
    createElement("h3", "", field(block, "title") || t("callout.note")),
    createElement("p", "", field(block, "content") || "")
  );
  return card;
}

function renderStepsBlock(block) {
  const card = createElement("article", "content-card steps-block");
  card.append(createBlockHeader(block));
  const list = document.createElement("ol");
  (block.items || []).forEach((item, index) => {
    const row = document.createElement("li");
    row.append(
      createElement("span", "step-number", String(index + 1).padStart(2, "0")),
      createElement("div", "step-copy")
    );
    const copy = row.querySelector(".step-copy");
    copy.append(
      createElement("strong", "", field(item, "title") || `${index + 1}`),
      createElement("p", "", field(item, "content") || "")
    );
    list.append(row);
  });
  card.append(list);
  return card;
}

function renderSplitBlock(block, renderToken) {
  if (!Array.isArray(block.blocks) || block.blocks.length !== 2 || block.blocks.some((child) => child.type === "split")) {
    throw new Error(t("block.invalidSplit"));
  }
  const ratios = new Set(["1:1", "3:2", "2:3"]);
  const ratio = ratios.has(block.ratio) ? block.ratio.replace(":", "-") : "1-1";
  const layout = createElement("div", `split-block split-${ratio}`);
  block.blocks.forEach((child) => layout.append(renderBlock(child, renderToken)));
  return layout;
}

function renderBlock(block, renderToken) {
  if (!block || typeof block.type !== "string") return createBlockError(t("block.invalid"));
  try {
    switch (block.type) {
      case "text": return renderTextBlock(block);
      case "markdown": return renderMarkdownBlock(block, renderToken);
      case "plot": return renderPlotBlock(block);
      case "code": return renderCodeBlock(block, renderToken);
      case "metrics": return renderMetricsBlock(block, renderToken);
      case "table": return renderTableBlock(block, renderToken);
      case "callout": return renderCalloutBlock(block);
      case "steps": return renderStepsBlock(block);
      case "split": return renderSplitBlock(block, renderToken);
      default: return createBlockError(t("block.unsupported", { type: block.type }));
    }
  } catch (error) {
    console.error("Block render failed:", error);
    return createBlockError(error.message);
  }
}

function configurePagination(sectionIndex) {
  const previous = state.manifest.sections[sectionIndex - 1];
  const next = state.manifest.sections[sectionIndex + 1];

  elements.previousSection.disabled = !previous;
  elements.previousSection.querySelector("strong").textContent = previous
    ? field(previous, "shortTitle") || field(previous, "title")
    : t("pagination.start");
  elements.previousSection.onclick = previous ? () => setRoute(state.project.id, previous.id) : null;

  elements.nextSection.disabled = !next;
  elements.nextSection.querySelector("strong").textContent = next
    ? field(next, "shortTitle") || field(next, "title")
    : t("pagination.end");
  elements.nextSection.onclick = next ? () => setRoute(state.project.id, next.id) : null;
}

function renderCurrentSection(focusHeading = false, preserveScroll = false) {
  const sectionIndex = state.manifest.sections.findIndex((section) => section.id === state.section.id);
  const renderToken = ++state.renderToken;

  elements.activeCaseLabel.textContent = field(state.project, "title");
  elements.projectEyebrow.textContent = field(state.manifest, "eyebrow") || t("case.fallbackEyebrow");
  elements.projectTitle.textContent = field(state.manifest, "title");
  elements.projectDescription.textContent = field(state.manifest, "description") || field(state.project, "description") || "";
  elements.sectionIndex.textContent = t("section.counter", {
    current: String(sectionIndex + 1).padStart(2, "0"),
    total: String(state.manifest.sections.length).padStart(2, "0")
  });
  elements.sectionTitle.textContent = field(state.section, "title");
  elements.sectionSummary.textContent = field(state.section, "summary") || "";
  elements.lastUpdated.textContent = t("section.lastUpdated", { value: state.manifest.lastUpdated || "—" });
  elements.contentVersion.textContent = t("section.version", { value: state.manifest.version || "—" });
  elements.sectionProgress.textContent = `${String(sectionIndex + 1).padStart(2, "0")} / ${String(state.manifest.sections.length).padStart(2, "0")}`;
  document.title = `${field(state.section, "title")} · ${field(state.manifest, "title")}`;

  populateRepositoryTree();
  populateSectionNav();
  const renderedBlocks = state.section.blocks.map((block) => renderBlock(block, renderToken));
  elements.contentBlocks.replaceChildren(...renderedBlocks);
  configurePagination(sectionIndex);

  elements.loadingState.hidden = true;
  elements.appError.hidden = true;
  elements.caseView.hidden = false;
  if (focusHeading) {
    elements.sectionTitle.setAttribute("tabindex", "-1");
    elements.sectionTitle.focus({ preventScroll: true });
  }
  if (!preserveScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleRoute(options = {}) {
  const navigationToken = ++state.navigationToken;
  showLoading(options.loadingMessage);

  try {
    if (!state.catalog) {
      const catalogUrl = new URL("./content/catalog.json", window.location.href);
      const catalog = validateCatalog(await fetchJson(catalogUrl));
      if (navigationToken !== state.navigationToken) return;
      state.catalogUrl = catalogUrl;
      state.catalog = catalog;
      if (!state.expansionInitialized) {
        state.expandedCategories = navigation.parseExpandedCategories(
          readExpandedCategories(),
          catalog.categories.map((category) => category.id)
        );
        state.expansionInitialized = true;
      } else {
        state.expandedCategories = navigation.parseExpandedCategories(
          navigation.serializeExpandedCategories(state.expandedCategories),
          catalog.categories.map((category) => category.id)
        );
        rememberExpandedCategories();
      }
      populateRepositoryTree();
    }

    const route = parseRoute();
    const projects = content.catalogProjects(state.catalog);
    const fallbackProjectId = state.catalog.defaultProject || projects[0].id;
    const project = projects.find((item) => item.id === route.projectId)
      || projects.find((item) => item.id === fallbackProjectId)
      || projects[0];

    const category = content.findProjectCategory(state.catalog, project.id);
    const shouldReloadManifest = !state.manifest || state.project?.id !== project.id || options.force;
    if (shouldReloadManifest) {
      ensureActiveCategory(category?.id);
      const { manifest, manifestUrl } = await loadProjectManifest(project);
      if (navigationToken !== state.navigationToken) return;
      state.project = project;
      state.category = category;
      state.manifest = manifest;
      state.manifestBase = new URL("./", manifestUrl);
      state.sectionCounts.set(project.id, manifest.sections.length);
    }

    const section = state.manifest.sections.find((item) => item.id === route.sectionId) || state.manifest.sections[0];
    state.section = section;
    const canonicalHash = routeFor(project.id, section.id);
    if (window.location.hash !== canonicalHash) history.replaceState(null, "", canonicalHash);
    renderCurrentSection(Boolean(options.focusHeading));
  } catch (error) {
    if (navigationToken !== state.navigationToken) return;
    console.error("Repository loading failed:", error);
    const fileProtocolHint = window.location.protocol === "file:" ? t("error.fileProtocol") : "";
    showGlobalError(t("error.loadTitle"), `${t("error.loadMessage")}${fileProtocolHint}`);
  }
}

elements.refreshButton.addEventListener("click", async () => {
  elements.refreshButton.disabled = true;
  elements.refreshButton.classList.add("loading");
  elements.categoryTree.setAttribute("aria-busy", "true");
  state.timestamp = Date.now();
  state.catalog = null;
  state.project = null;
  state.category = null;
  state.manifest = null;
  state.section = null;
  state.treeCountToken += 1;
  state.sectionCounts.clear();
  state.sectionCountFailures.clear();
  state.sectionCountPending.clear();
  state.manifestCache.clear();
  state.dataCache.clear();
  await handleRoute({ force: true, loadingMessage: t("loading.refresh") });
  elements.categoryTree.removeAttribute("aria-busy");
  elements.refreshButton.disabled = false;
  elements.refreshButton.classList.remove("loading");
});

document.querySelectorAll(".language-option").forEach((button) => {
  button.addEventListener("click", () => setLocale(button.dataset.locale));
});

window.addEventListener("hashchange", () => handleRoute({ focusHeading: true }));
rememberLocale(state.locale);
history.replaceState(null, "", content.urlWithLocale(window.location.href, state.locale));
applyShellTranslations();
handleRoute();
