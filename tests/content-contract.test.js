"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const utils = require("../docs/js/content-utils.js");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const CONTENT = path.join(DOCS, "content");
const RETIRED_PRODUCT_TERMS = /\b(?:tutorials?|lessons?|courses?)\b|教學|教学|課程|课程|課時|课时/iu;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function assertFiniteNumbers(value, location) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${location} 必須是有限數值`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => assertFiniteNumbers(item, `${location}.${key}`));
  }
}

function assertLocalized(record, fields, location) {
  const visibleFields = fields.filter((field) => Object.prototype.hasOwnProperty.call(record, field));
  if (!visibleFields.length) return;
  assert.ok(record.i18n?.["zh-Hant"], `${location} 缺少繁體中文內容`);
  visibleFields.forEach((field) => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(record.i18n["zh-Hant"], field),
      `${location}.${field} 缺少繁體中文內容`
    );
    assertVisibleValue(record[field], `${location}.${field}`);
    assertVisibleValue(record.i18n["zh-Hant"][field], `${location}.i18n.zh-Hant.${field}`);
    assertNoRetiredProductTerms(record[field], `${location}.${field}`);
    assertNoRetiredProductTerms(record.i18n["zh-Hant"][field], `${location}.i18n.zh-Hant.${field}`);
  });
}

function assertVisibleValue(value, location) {
  if (typeof value === "string") {
    assert.ok(value.trim(), `${location} 不可為空字串`);
    return;
  }
  if (Array.isArray(value)) {
    assert.ok(value.length, `${location} 不可為空陣列`);
    value.forEach((item, index) => assertVisibleValue(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    assert.ok(entries.length, `${location} 不可為空物件`);
    entries.forEach(([key, item]) => assertVisibleValue(item, `${location}.${key}`));
    return;
  }
  assert.fail(`${location} 必須是可見文字、文字陣列或文字對照表`);
}

function assertNoRetiredProductTerms(value, location) {
  if (typeof value === "string") {
    assert.doesNotMatch(value, RETIRED_PRODUCT_TERMS, `${location} 仍含舊教學產品詞：${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRetiredProductTerms(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => assertNoRetiredProductTerms(item, `${location}.${key}`));
  }
}

function markdownProse(markdown) {
  return markdown
    .replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");
}

function inspectBlock(block, artifacts, location, projectId, coverage) {
  assertLocalized(block, ["eyebrow", "title", "description", "caption", "content", "paragraphs"], location);
  const expectedKind = {
    plot: "plot",
    code: "matlab-code",
    markdown: "markdown"
  }[block.type] || null;
  if (expectedKind) assert.equal(typeof block.artifact, "string", `${location} 必須引用 artifact`);
  if (block.artifact) {
    assert.ok(artifacts.has(block.artifact), `${location} 引用不存在的 artifact ${block.artifact}`);
    if (expectedKind) assert.equal(artifacts.get(block.artifact).kind, expectedKind, `${location} artifact 類型錯誤`);
    if (block.type === "markdown") coverage.markdownReferences.add(`${projectId}:${block.artifact}`);
  }
  if (block.source) {
    assert.ok(artifacts.has(block.source), `${location} 引用不存在的資料來源 ${block.source}`);
    assert.equal(artifacts.get(block.source).kind, "json", `${location} 資料來源必須是 JSON`);
  }
  (block.items || []).forEach((item, index) => {
    assertLocalized(item, ["label", "detail", "detailTemplate", "title", "content"], `${location}.items[${index}]`);
  });
  (block.columns || []).forEach((column, index) => {
    const fields = column.label === "RMSE" ? ["valueLabels"] : ["label", "valueLabels"];
    assertLocalized(column, fields, `${location}.columns[${index}]`);
  });
  (block.blocks || []).forEach((child, index) => {
    inspectBlock(child, artifacts, `${location}.blocks[${index}]`, projectId, coverage);
  });
}

function assertPng(file) {
  const buffer = fs.readFileSync(file);
  assert.ok(buffer.length > 24, `${file} PNG 檔案過小`);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${file} 不是有效 PNG`);
  assert.ok(buffer.readUInt32BE(16) >= 300, `${file} 寬度過小`);
  assert.ok(buffer.readUInt32BE(20) >= 200, `${file} 高度過小`);
}

test("分類樹、案例內容、翻譯與資源符合 V2.2 契約", () => {
  const catalogFile = path.join(CONTENT, "catalog.json");
  const catalog = utils.validateCatalog(readJson(catalogFile));
  assert.equal(catalog.schemaVersion, "2.2");
  assert.equal(catalog.localization.defaultLocale, "en");
  assert.deepEqual(catalog.localization.supportedLocales, ["en", "zh-Hant"]);
  assertLocalized(catalog, ["siteTitle"], "catalog");
  assert.ok(Array.isArray(catalog.categories), "catalog.categories 必須是陣列");
  assert.ok(catalog.categories.length >= 2, "至少需要兩個模型分類");

  const categoryIds = new Set();
  const projectIds = new Set();
  const projects = [];
  catalog.categories.forEach((category, categoryIndex) => {
    assert.equal(typeof category.title, "string", `catalog.categories[${categoryIndex}] 缺少英文標題`);
    assert.ok(Array.isArray(category.projects) && category.projects.length, `${category.id} 必須包含案例`);
    assert.ok(!categoryIds.has(category.id), `分類 ID 重複：${category.id}`);
    categoryIds.add(category.id);
    assertLocalized(category, ["title", "description"], `catalog.categories[${categoryIndex}]`);

    category.projects.forEach((project, projectIndex) => {
      const location = `catalog.categories[${categoryIndex}].projects[${projectIndex}]`;
      assert.equal(typeof project.title, "string", `${location} 缺少英文標題`);
      assert.ok(!projectIds.has(project.id), `案例 ID 必須跨分類唯一：${project.id}`);
      projectIds.add(project.id);
      assertLocalized(project, ["title", "description", "topic"], location);
      projects.push(project);
    });
  });
  assert.ok(projects.length >= 4, "至少需要四個獨立 MATLAB 案例");
  assert.ok(projectIds.has(catalog.defaultProject), "defaultProject 必須指向存在的案例");

  const coverage = {
    markdownArtifacts: new Set(),
    markdownReferences: new Set()
  };

  projects.forEach((project) => {
    const manifestFile = path.resolve(path.dirname(catalogFile), project.manifest);
    assert.ok(manifestFile.startsWith(CONTENT + path.sep), `${project.id} manifest 必須位於 content 目錄`);
    assert.ok(fs.existsSync(manifestFile), `${project.id} manifest 不存在`);

    const manifest = utils.validateManifest(readJson(manifestFile), project.id);
    assert.equal(
      manifest.schemaVersion,
      utils.MANIFEST_SCHEMA_VERSION,
      `${project.id} manifest schema 必須符合目前內容契約`
    );
    assertLocalized(manifest, ["title", "eyebrow", "description"], `manifest.${project.id}`);
    const projectDirectory = path.dirname(manifestFile);
    const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.id, artifact]));

    manifest.artifacts.forEach((artifact, artifactIndex) => {
      const url = utils.resolveRelativeUrl("https://example.test/repository/manifest.json", artifact.file);
      assert.equal(url.origin, "https://example.test");
      const file = path.resolve(projectDirectory, artifact.file);
      assert.ok(file.startsWith(projectDirectory + path.sep), `${artifact.file} 不可離開專案目錄`);
      assert.ok(fs.existsSync(file), `${project.id} 缺少資源 ${artifact.file}`);
      assert.ok(fs.statSync(file).size > 0, `${artifact.file} 不可為空檔案`);
      Object.entries(artifact.fileByLocale || {}).forEach(([locale, localizedFile]) => {
        const localizedUrl = utils.resolveRelativeUrl("https://example.test/repository/manifest.json", localizedFile);
        assert.equal(localizedUrl.origin, "https://example.test");
        const localizedPath = path.resolve(projectDirectory, localizedFile);
        assert.ok(localizedPath.startsWith(projectDirectory + path.sep), `${localizedFile} 不可離開專案目錄`);
        assert.ok(fs.existsSync(localizedPath), `${project.id} 缺少 ${locale} 資源 ${localizedFile}`);
        assert.ok(fs.statSync(localizedPath).size > 0, `${localizedFile} 不可為空檔案`);
        if (artifact.kind === "markdown") {
          assert.equal(path.extname(localizedPath).toLowerCase(), ".md", `${localizedFile} 應為 Markdown 文件`);
          assertNoRetiredProductTerms(
            markdownProse(fs.readFileSync(localizedPath, "utf8")),
            `${project.id}.${localizedFile}`
          );
        }
      });
      ["label", "alt", "caption"].forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(artifact, field)) return;
        assertVisibleValue(artifact[field], `manifest.${project.id}.artifacts[${artifactIndex}].${field}`);
        assertNoRetiredProductTerms(artifact[field], `manifest.${project.id}.artifacts[${artifactIndex}].${field}`);
        if (Object.prototype.hasOwnProperty.call(artifact.i18n?.["zh-Hant"] || {}, field)) {
          const translated = artifact.i18n["zh-Hant"][field];
          assertVisibleValue(translated, `manifest.${project.id}.artifacts[${artifactIndex}].i18n.zh-Hant.${field}`);
          assertNoRetiredProductTerms(translated, `manifest.${project.id}.artifacts[${artifactIndex}].i18n.zh-Hant.${field}`);
        }
      });
      if (artifact.kind === "plot") {
        assertLocalized(artifact, ["label", "alt", "caption"], `manifest.${project.id}.artifacts[${artifactIndex}]`);
        assertPng(file);
      } else if (artifact.kind === "json") {
        assertFiniteNumbers(readJson(file), `${project.id}.${artifact.file}`);
      } else if (artifact.kind === "matlab-code") {
        assert.equal(path.extname(file), ".m", `${artifact.file} 應為 MATLAB 程式碼`);
      } else if (artifact.kind === "markdown") {
        assert.equal(path.extname(file).toLowerCase(), ".md", `${artifact.file} 應為 Markdown 文件`);
        coverage.markdownArtifacts.add(`${project.id}:${artifact.id}`);
        assertNoRetiredProductTerms(markdownProse(fs.readFileSync(file, "utf8")), `${project.id}.${artifact.file}`);
      }
      if (artifact.generatedBy) assert.ok(artifacts.has(artifact.generatedBy), `${artifact.id}.generatedBy 無效`);
    });

    manifest.sections.forEach((section, sectionIndex) => {
      assertLocalized(section, ["title", "shortTitle", "summary"], `manifest.${project.id}.sections[${sectionIndex}]`);
      section.blocks.forEach((block, blockIndex) => {
        inspectBlock(
          block,
          artifacts,
          `manifest.${project.id}.sections[${sectionIndex}].blocks[${blockIndex}]`,
          project.id,
          coverage
        );
      });
    });
  });

  assert.ok(coverage.markdownArtifacts.size > 0, "至少需要一個本機 Markdown artifact");
  coverage.markdownArtifacts.forEach((artifactKey) => {
    assert.ok(coverage.markdownReferences.has(artifactKey), `Markdown artifact 未被 markdown block 引用：${artifactKey}`);
  });
});

test("所有可見產品文案都不再使用舊教學定位詞", () => {
  const htmlSource = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  const html = htmlSource
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  assertNoRetiredProductTerms(html, "docs/index.html 可見文字");
  const accessibleLabels = [...htmlSource.matchAll(/\b(?:aria-label|title|placeholder|alt)\s*=\s*(["'])(.*?)\1/gi)]
    .map((match) => match[2]);
  accessibleLabels.forEach((value, index) => {
    assertNoRetiredProductTerms(value, `docs/index.html 可存取標籤 ${index}`);
  });
  const metaDescription = htmlSource.match(/<meta\s+name=["']description["']\s+content=(["'])(.*?)\1/i)?.[2];
  if (metaDescription) assertNoRetiredProductTerms(metaDescription, "docs/index.html description");

  const utilitySource = fs.readFileSync(path.join(DOCS, "js", "content-utils.js"), "utf8");
  const messagesStart = utilitySource.indexOf("const UI_MESSAGES");
  const messagesEnd = utilitySource.indexOf("\n  });", messagesStart);
  assert.ok(messagesStart >= 0 && messagesEnd > messagesStart, "找不到 UI_MESSAGES 詞典");
  const messageBlock = utilitySource.slice(messagesStart, messagesEnd);
  const messageValues = [...messageBlock.matchAll(/^\s*"[^"\r\n]+"\s*:\s*("(?:\\.|[^"\\])*")\s*,?\s*$/gm)]
    .map((match) => JSON.parse(match[1]));
  assert.ok(messageValues.length >= 10, "UI_MESSAGES 可見訊息擷取失敗");
  messageValues.forEach((value, index) => assertNoRetiredProductTerms(value, `UI_MESSAGES value ${index}`));
});

test("程式碼檔案不超過 1000 行且頁面不依賴遠端資源", () => {
  const codeFiles = walk(ROOT).filter((file) => {
    if (file.includes(`${path.sep}work${path.sep}`)) return false;
    return [".js", ".css", ".m"].includes(path.extname(file));
  });
  codeFiles.forEach((file) => {
    const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
    assert.ok(lineCount <= 1000, `${path.relative(ROOT, file)} 有 ${lineCount} 行，超過 1000 行上限`);
  });

  const pageFiles = [path.join(DOCS, "index.html"), ...walk(path.join(DOCS, "css")), ...walk(path.join(DOCS, "js"))];
  pageFiles.forEach((file) => {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:src|href)=["']https?:\/\//i, `${file} 不可載入 CDN`);
  });
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  assert.doesNotMatch(html, /(?:src|href)=["']\//i, "HTML 資源路徑不可從網域根目錄開始");
});
