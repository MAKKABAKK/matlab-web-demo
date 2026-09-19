(function initContentUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MatlabCaseRepositoryContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentUtils() {
  "use strict";

  const DEFAULT_LOCALE = "en";
  const SUPPORTED_LOCALES = Object.freeze(["en", "zh-Hant"]);
  const STORAGE_KEY = "matlab-code-repository.locale";
  const SCHEMA_VERSION = "2.2";
  const MANIFEST_SCHEMA_VERSION = "2.1";

  const UI_MESSAGES = Object.freeze({
    en: {
      "skip.content": "Skip to code case content",
      "nav.repository": "Code repository navigation",
      "brand.tagline": "Model code case repository",
      "repository.categories": "MODEL CATEGORIES",
      "repository.tree": "Model category tree",
      "repository.caseCount": "{count} cases",
      "repository.emptyCategory": "No cases yet",
      "case.outline": "CASE SECTIONS",
      "sidebar.manifestTitle": "Content driven",
      "sidebar.manifestBody": "Add cases without editing HTML",
      "language.label": "Display language",
      "refresh.button": "Refresh Content",
      "refresh.note": "Refresh reloads published manifests, JSON, code, and plots. It does not run MATLAB.",
      "workflow.manifest": "Case Manifest",
      "workflow.renderer": "Static Case Viewer",
      "error.loadTitle": "Unable to load repository content.",
      "error.loadMessage": "Check the catalog or case manifest and try again.",
      "error.fileProtocol": " Open this site through a local HTTP server; browsers block content requests on file:// URLs.",
      "loading.case": "Loading code case…",
      "loading.refresh": "Refreshing published content…",
      "section.counter": "SECTION {current} OF {total}",
      "section.lastUpdated": "Last updated: {value}",
      "section.version": "Version: {value}",
      "case.fallbackEyebrow": "MATLAB CODE CASE",
      "sections.count": "{count} sections",
      "pagination.label": "Case section pagination",
      "pagination.previous": "Previous section",
      "pagination.next": "Next section",
      "pagination.start": "Start",
      "pagination.end": "End",
      "copy.ready": "Copy Code",
      "copy.success": "Copied",
      "copy.failure": "Copy failed",
      "code.loading": "Loading MATLAB source…",
      "code.unavailable": "Unable to load {file}. {reason}",
      "markdown.loading": "Loading documentation…",
      "markdown.unavailable": "Unable to load {file}. {reason}",
      "plot.unavailable": "Plot unavailable",
      "plot.hint": "Run MATLAB and verify {file}.",
      "metric.fallback": "Metric",
      "metric.loading": "Loading…",
      "metric.noData": "No data",
      "table.loading": "Loading table data…",
      "table.invalidRows": "The configured table path is not an array.",
      "table.noColumns": "The table has no columns.",
      "block.errorTitle": "This content block could not be loaded.",
      "block.invalid": "This block has no valid type.",
      "block.unsupported": "Unsupported block type: {type}",
      "block.metricsSource": "Unable to load metric data.",
      "block.tableSource": "Unable to load table data.",
      "block.invalidSplit": "A split block must contain exactly two regular blocks.",
      "callout.note": "Note",
      "footer.text": "MATLAB code case repository · Static, portable, and ready for GitHub Pages",
      "noscript.text": "This repository requires JavaScript to read its content manifests."
    },
    "zh-Hant": {
      "skip.content": "跳至程式碼案例內容",
      "nav.repository": "程式碼案例庫導覽",
      "brand.tagline": "模型程式碼案例庫",
      "repository.categories": "模型分類",
      "repository.tree": "模型分類樹",
      "repository.caseCount": "{count} 個案例",
      "repository.emptyCategory": "尚無案例",
      "case.outline": "案例章節",
      "sidebar.manifestTitle": "由內容清單驅動",
      "sidebar.manifestBody": "新增案例時不必修改 HTML",
      "language.label": "顯示語言",
      "refresh.button": "重新整理內容",
      "refresh.note": "重新整理會載入已發布的內容清單、JSON、程式碼與圖表，但不會執行 MATLAB。",
      "workflow.manifest": "案例清單",
      "workflow.renderer": "靜態案例瀏覽器",
      "error.loadTitle": "無法載入案例庫內容。",
      "error.loadMessage": "請檢查案例目錄或案例清單後再試一次。",
      "error.fileProtocol": " 請透過本機 HTTP 伺服器開啟網站；瀏覽器會阻擋 file:// 網址的內容請求。",
      "loading.case": "正在載入程式碼案例…",
      "loading.refresh": "正在重新載入已發布內容…",
      "section.counter": "第 {current} 節，共 {total} 節",
      "section.lastUpdated": "最後更新：{value}",
      "section.version": "版本：{value}",
      "case.fallbackEyebrow": "MATLAB 程式碼案例",
      "sections.count": "{count} 節",
      "pagination.label": "案例章節分頁",
      "pagination.previous": "上一節",
      "pagination.next": "下一節",
      "pagination.start": "開始",
      "pagination.end": "結束",
      "copy.ready": "複製程式碼",
      "copy.success": "已複製",
      "copy.failure": "複製失敗",
      "code.loading": "正在載入 MATLAB 程式碼…",
      "code.unavailable": "無法載入 {file}。{reason}",
      "markdown.loading": "正在載入說明文件…",
      "markdown.unavailable": "無法載入 {file}。{reason}",
      "plot.unavailable": "圖表無法使用",
      "plot.hint": "請執行 MATLAB 並確認 {file}。",
      "metric.fallback": "指標",
      "metric.loading": "載入中…",
      "metric.noData": "沒有資料",
      "table.loading": "正在載入表格資料…",
      "table.invalidRows": "設定的表格資料路徑不是陣列。",
      "table.noColumns": "此表格沒有欄位。",
      "block.errorTitle": "此內容區塊無法載入。",
      "block.invalid": "此區塊沒有有效的類型。",
      "block.unsupported": "不支援的內容類型：{type}",
      "block.metricsSource": "無法載入指標資料。",
      "block.tableSource": "無法載入表格資料。",
      "block.invalidSplit": "並排區塊必須包含兩個一般內容區塊。",
      "callout.note": "說明",
      "footer.text": "MATLAB 程式碼案例庫 · 靜態、可攜，並可直接部署至 GitHub Pages",
      "noscript.text": "此案例庫需要 JavaScript 才能讀取內容清單。"
    }
  });

  function canonicalizeLocale(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const normalized = value.trim().replace(/_/g, "-").toLowerCase();
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
    if (
      normalized === "zh-hant"
      || normalized.startsWith("zh-hant-")
      || normalized === "zh-tw"
      || normalized.startsWith("zh-tw-")
      || normalized === "zh-hk"
      || normalized.startsWith("zh-hk-")
      || normalized === "zh-mo"
      || normalized.startsWith("zh-mo-")
    ) {
      return "zh-Hant";
    }
    return null;
  }

  function parseLocaleFromSearch(search) {
    try {
      return canonicalizeLocale(new URLSearchParams(search || "").get("lang"));
    } catch {
      return null;
    }
  }

  function selectLocale({ search = "", storedLocale = null, browserLocales = [], defaultLocale = DEFAULT_LOCALE } = {}) {
    const candidates = [
      parseLocaleFromSearch(search),
      canonicalizeLocale(storedLocale),
      ...[].concat(browserLocales || []).map(canonicalizeLocale),
      canonicalizeLocale(defaultLocale),
      DEFAULT_LOCALE
    ];
    return candidates.find((locale) => SUPPORTED_LOCALES.includes(locale)) || DEFAULT_LOCALE;
  }

  function localizedField(record, field, locale, defaultLocale = DEFAULT_LOCALE) {
    if (!record || typeof record !== "object") return undefined;
    const normalizedLocale = canonicalizeLocale(locale) || canonicalizeLocale(defaultLocale) || DEFAULT_LOCALE;
    if (
      normalizedLocale !== defaultLocale
      && record.i18n
      && record.i18n[normalizedLocale]
      && Object.prototype.hasOwnProperty.call(record.i18n[normalizedLocale], field)
    ) {
      return record.i18n[normalizedLocale][field];
    }
    return record[field];
  }

  function interpolate(template, params = {}) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
    ));
  }

  function translateMessage(locale, key, params = {}) {
    const normalizedLocale = canonicalizeLocale(locale) || DEFAULT_LOCALE;
    const template = UI_MESSAGES[normalizedLocale]?.[key] ?? UI_MESSAGES[DEFAULT_LOCALE]?.[key] ?? key;
    return interpolate(template, params);
  }

  function urlWithLocale(currentUrl, locale) {
    const url = new URL(currentUrl);
    url.searchParams.set("lang", canonicalizeLocale(locale) || DEFAULT_LOCALE);
    return url;
  }

  function validateId(value, label) {
    if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      throw new Error(`${label} must use lowercase letters, numbers, and hyphens.`);
    }
  }

  function placeholders(value) {
    if (typeof value !== "string") return [];
    return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
  }

  function sameValueShape(baseValue, translatedValue) {
    if (Array.isArray(baseValue) || Array.isArray(translatedValue)) {
      return Array.isArray(baseValue)
        && Array.isArray(translatedValue)
        && translatedValue.every((item) => typeof item === "string");
    }
    if (baseValue && translatedValue && typeof baseValue === "object" && typeof translatedValue === "object") {
      const baseKeys = Object.keys(baseValue).sort();
      const translatedKeys = Object.keys(translatedValue).sort();
      return JSON.stringify(baseKeys) === JSON.stringify(translatedKeys)
        && translatedKeys.every((key) => typeof translatedValue[key] === "string");
    }
    return typeof baseValue === typeof translatedValue;
  }

  function validateI18n(record, allowedFields, location) {
    if (!record?.i18n) return;
    if (typeof record.i18n !== "object" || Array.isArray(record.i18n)) {
      throw new Error(`${location}.i18n must be an object.`);
    }

    Object.entries(record.i18n).forEach(([locale, values]) => {
      if (!SUPPORTED_LOCALES.includes(locale) || locale === DEFAULT_LOCALE) {
        throw new Error(`${location}.i18n uses an unsupported or redundant locale: ${locale}`);
      }
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        throw new Error(`${location}.i18n.${locale} must be an object.`);
      }
      Object.entries(values).forEach(([field, translatedValue]) => {
        if (!allowedFields.includes(field)) {
          throw new Error(`${location}.i18n.${locale} cannot translate ${field}.`);
        }
        if (!Object.prototype.hasOwnProperty.call(record, field)) {
          throw new Error(`${location}.i18n.${locale} references a missing field: ${field}`);
        }
        if (!sameValueShape(record[field], translatedValue)) {
          throw new Error(`${location}.i18n.${locale}.${field} must match the base field type.`);
        }
        if (
          typeof record[field] === "string"
          && placeholders(record[field]).join("|") !== placeholders(translatedValue).join("|")
        ) {
          throw new Error(`${location}.i18n.${locale}.${field} must preserve template placeholders.`);
        }
      });
    });
  }

  function validateBlock(block, location) {
    if (!block || typeof block.type !== "string") {
      throw new Error(`${location} needs a block type.`);
    }
    const supportedTypes = new Set(["text", "markdown", "code", "plot", "metrics", "table", "callout", "steps", "split"]);
    if (!supportedTypes.has(block.type)) throw new Error(`${location} uses an unsupported block type: ${block.type}`);
    validateI18n(block, ["eyebrow", "title", "description", "caption", "content", "paragraphs"], location);

    if (block.type === "metrics") {
      (block.items || []).forEach((item, index) => {
        validateI18n(item, ["label", "detail", "detailTemplate"], `${location}.items[${index}]`);
      });
    }
    if (block.type === "table") {
      (block.columns || []).forEach((column, index) => {
        validateI18n(column, ["label", "valueLabels"], `${location}.columns[${index}]`);
      });
    }
    if (block.type === "steps") {
      (block.items || []).forEach((item, index) => {
        validateI18n(item, ["title", "content"], `${location}.items[${index}]`);
      });
    }
    if (block.type === "split") {
      if (!Array.isArray(block.blocks) || block.blocks.length !== 2 || block.blocks.some((child) => child.type === "split")) {
        throw new Error(`${location} must contain exactly two non-split blocks.`);
      }
      block.blocks.forEach((child, index) => validateBlock(child, `${location}.blocks[${index}]`));
    }
  }

  function catalogProjects(catalog) {
    if (!catalog || !Array.isArray(catalog.categories)) return [];
    return catalog.categories.flatMap((category) => category.projects || []);
  }

  function findProjectCategory(catalog, projectId) {
    return catalog?.categories?.find((category) => (
      Array.isArray(category.projects) && category.projects.some((project) => project.id === projectId)
    )) || null;
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.schemaVersion !== SCHEMA_VERSION || !Array.isArray(catalog.categories) || !catalog.categories.length) {
      throw new Error("catalog.json does not match the V2.2 repository contract.");
    }
    validateI18n(catalog, ["siteTitle"], "catalog");

    const categoryIds = new Set();
    const projectIds = new Set();
    catalog.categories.forEach((category, categoryIndex) => {
      validateId(category.id, "Category ID");
      if (categoryIds.has(category.id)) throw new Error(`Duplicate category ID: ${category.id}`);
      if (typeof category.title !== "string" || !Array.isArray(category.projects) || !category.projects.length) {
        throw new Error(`Category ${category.id} needs a title and at least one project.`);
      }
      validateI18n(category, ["title", "description"], `catalog.categories[${categoryIndex}]`);
      category.projects.forEach((project, projectIndex) => {
        validateId(project.id, "Project ID");
        if (projectIds.has(project.id)) throw new Error(`Duplicate project ID: ${project.id}`);
        if (typeof project.title !== "string" || typeof project.manifest !== "string") {
          throw new Error(`Project ${project.id} is missing a title or manifest path.`);
        }
        validateI18n(project, ["title", "description", "topic"], `catalog.categories[${categoryIndex}].projects[${projectIndex}]`);
        projectIds.add(project.id);
      });
      categoryIds.add(category.id);
    });

    if (typeof catalog.defaultProject !== "string" || !projectIds.has(catalog.defaultProject)) {
      throw new Error("The default project is not present in catalog.json.");
    }
    return catalog;
  }

  function validateManifest(manifest, expectedId) {
    if (!manifest || manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.id !== expectedId) {
      throw new Error("The project manifest does not match the selected catalog entry.");
    }
    if (!Array.isArray(manifest.artifacts) || !Array.isArray(manifest.sections) || !manifest.sections.length) {
      throw new Error("The project manifest needs artifacts and at least one section.");
    }
    validateI18n(manifest, ["title", "eyebrow", "description"], `manifest.${expectedId}`);

    const artifactIds = new Set();
    manifest.artifacts.forEach((artifact, index) => {
      validateId(artifact.id, "Artifact ID");
      if (artifactIds.has(artifact.id)) throw new Error(`Duplicate artifact ID: ${artifact.id}`);
      if (typeof artifact.kind !== "string" || typeof artifact.file !== "string") {
        throw new Error(`Artifact ${artifact.id} is missing a kind or file path.`);
      }
      if (artifact.fileByLocale) {
        if (typeof artifact.fileByLocale !== "object" || Array.isArray(artifact.fileByLocale)) {
          throw new Error(`Artifact ${artifact.id}.fileByLocale must be an object.`);
        }
        Object.entries(artifact.fileByLocale).forEach(([locale, file]) => {
          if (!SUPPORTED_LOCALES.includes(locale) || locale === DEFAULT_LOCALE || typeof file !== "string") {
            throw new Error(`Artifact ${artifact.id} has an invalid localized file.`);
          }
        });
      }
      if (artifact.kind === "plot" && typeof artifact.alt !== "string") {
        throw new Error(`Plot artifact ${artifact.id} needs alternative text.`);
      }
      validateI18n(artifact, ["label", "alt", "caption"], `manifest.artifacts[${index}]`);
      artifactIds.add(artifact.id);
    });
    manifest.artifactMap = Object.fromEntries(manifest.artifacts.map((artifact) => [artifact.id, artifact]));

    const sectionIds = new Set();
    manifest.sections.forEach((section, sectionIndex) => {
      validateId(section.id, "Section ID");
      if (sectionIds.has(section.id)) throw new Error(`Duplicate section ID: ${section.id}`);
      if (!Array.isArray(section.blocks)) throw new Error(`Section ${section.id} has no blocks array.`);
      validateI18n(section, ["title", "shortTitle", "summary"], `manifest.sections[${sectionIndex}]`);
      section.blocks.forEach((block, blockIndex) => {
        validateBlock(block, `manifest.sections[${sectionIndex}].blocks[${blockIndex}]`);
      });
      sectionIds.add(section.id);
    });
    return manifest;
  }

  function resolveRelativeUrl(baseUrl, relativePath) {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      throw new Error("A content path is empty.");
    }
    const decodedPath = (() => {
      try {
        return decodeURIComponent(relativePath);
      } catch {
        return relativePath;
      }
    })();
    if (
      /^(?:[a-z]+:|\/|\\)/i.test(relativePath)
      || decodedPath.split(/[\\/]/).includes("..")
      || relativePath.split(/[\\/]/).includes("..")
    ) {
      throw new Error(`Only project-relative content paths are allowed: ${relativePath}`);
    }

    const base = new URL(baseUrl);
    const url = new URL(relativePath, base);
    if (url.origin !== base.origin) throw new Error("Cross-origin content paths are not allowed.");
    return url;
  }

  return Object.freeze({
    DEFAULT_LOCALE,
    MANIFEST_SCHEMA_VERSION,
    SCHEMA_VERSION,
    STORAGE_KEY,
    SUPPORTED_LOCALES,
    UI_MESSAGES,
    catalogProjects,
    canonicalizeLocale,
    findProjectCategory,
    interpolate,
    localizedField,
    parseLocaleFromSearch,
    resolveRelativeUrl,
    selectLocale,
    translateMessage,
    urlWithLocale,
    validateCatalog,
    validateId,
    validateI18n,
    validateManifest
  });
});
