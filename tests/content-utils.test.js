"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const utils = require("../docs/js/content-utils.js");

test("語言代碼會正規化並拒絕不支援的簡體中文", () => {
  assert.equal(utils.canonicalizeLocale("en-US"), "en");
  assert.equal(utils.canonicalizeLocale("zh-Hant-HK"), "zh-Hant");
  assert.equal(utils.canonicalizeLocale("zh_TW"), "zh-Hant");
  assert.equal(utils.canonicalizeLocale("zh-HK"), "zh-Hant");
  assert.equal(utils.canonicalizeLocale("zh-CN"), null);
  assert.equal(utils.canonicalizeLocale(""), null);
});

test("語言選擇依序採用 URL、儲存值、瀏覽器與預設值", () => {
  assert.equal(utils.selectLocale({
    search: "?lang=zh-Hant",
    storedLocale: "en",
    browserLocales: ["en-US"]
  }), "zh-Hant");
  assert.equal(utils.selectLocale({
    search: "?lang=unsupported",
    storedLocale: "zh-TW",
    browserLocales: ["en-US"]
  }), "zh-Hant");
  assert.equal(utils.selectLocale({
    browserLocales: ["zh-CN", "en-GB"]
  }), "en");
});

test("本地化欄位逐欄回退且不修改原始物件", () => {
  const record = {
    title: "English title",
    count: 0,
    i18n: { "zh-Hant": { title: "繁體標題", count: 0 } }
  };
  const before = JSON.stringify(record);
  assert.equal(utils.localizedField(record, "title", "zh-Hant"), "繁體標題");
  assert.equal(utils.localizedField(record, "count", "zh-Hant"), 0);
  assert.equal(utils.localizedField(record, "missing", "zh-Hant"), undefined);
  assert.equal(utils.localizedField(record, "title", "fr"), "English title");
  assert.equal(JSON.stringify(record), before);
});

test("訊息插值保留未知占位符", () => {
  assert.equal(utils.interpolate("{current}/{total}/{missing}", { current: 2, total: 6 }), "2/6/{missing}");
  assert.equal(utils.translateMessage("zh-Hant", "section.counter", { current: "01", total: "06" }), "第 01 節，共 06 節");
  assert.equal(utils.translateMessage("unknown", "copy.ready"), "Copy Code");
});

test("更新語言參數時保留倉庫子路徑、其他查詢與 hash", () => {
  const updated = utils.urlWithLocale(
    "https://example.test/repository-name/?preview=1&lang=en#/project/demo/section/overview",
    "zh-TW"
  );
  assert.equal(updated.pathname, "/repository-name/");
  assert.equal(updated.searchParams.get("preview"), "1");
  assert.equal(updated.searchParams.get("lang"), "zh-Hant");
  assert.equal(updated.hash, "#/project/demo/section/overview");
});

test("內容路徑只允許同源且不含父目錄的相對路徑", () => {
  const base = "https://example.test/repository-name/content/projects/demo/manifest.json";
  assert.equal(
    utils.resolveRelativeUrl(base, "plots/result.png").href,
    "https://example.test/repository-name/content/projects/demo/plots/result.png"
  );
  [
    "../secret.txt",
    "%2e%2e/secret.txt",
    "%2E%2E%2Fsecret.txt",
    "/root.txt",
    "https://attacker.test/file",
    "//attacker.test/file",
    "\\\\server\\share",
    "folder\\..\\secret.txt"
  ].forEach((path) => assert.throws(() => utils.resolveRelativeUrl(base, path)));
});

test("i18n 驗證拒絕行為欄位與遺失模板占位符", () => {
  assert.throws(() => utils.validateI18n({
    title: "Title",
    file: "a.png",
    i18n: { "zh-Hant": { file: "b.png" } }
  }, ["title"], "record"), /cannot translate file/);
  assert.throws(() => utils.validateI18n({
    detail: "Value {value}",
    i18n: { "zh-Hant": { detail: "數值" } }
  }, ["detail"], "record"), /preserve template placeholders/);
  assert.throws(() => utils.validateI18n({
    valueLabels: { Stable: "Stable", Unstable: "Unstable" },
    i18n: { "zh-Hant": { valueLabels: { Stable: "穩定" } } }
  }, ["valueLabels"], "record"), /match the base field type/);
});

test("最小分類 catalog 與 manifest 符合 V2.2 契約", () => {
  const catalog = {
    schemaVersion: "2.2",
    defaultProject: "demo",
    categories: [{
      id: "forecasting",
      title: "Forecasting",
      projects: [{ id: "demo", title: "Demo case", manifest: "projects/demo/manifest.json" }]
    }]
  };
  const manifest = {
    schemaVersion: "2.1",
    id: "demo",
    title: "Demo case",
    artifacts: [{ id: "results", kind: "json", file: "data/results.json" }],
    sections: [{ id: "overview", title: "Overview", blocks: [{ type: "text", content: "Hello" }] }]
  };
  assert.equal(utils.validateCatalog(catalog), catalog);
  assert.equal(utils.validateManifest(manifest, "demo"), manifest);
  assert.ok(manifest.artifactMap.results);
});

test("分類樹要求 defaultProject 存在且案例 ID 跨分類唯一", () => {
  const category = (id, projectId) => ({
    id,
    title: id,
    projects: [{ id: projectId, title: projectId, manifest: `projects/${projectId}/manifest.json` }]
  });

  assert.throws(() => utils.validateCatalog({
    schemaVersion: "2.2",
    categories: [category("forecasting", "demo")]
  }), /default\s*project/i);

  assert.throws(() => utils.validateCatalog({
    schemaVersion: "2.2",
    defaultProject: "missing",
    categories: [category("forecasting", "demo")]
  }), /default\s*project/i);

  assert.throws(() => utils.validateCatalog({
    schemaVersion: "2.2",
    defaultProject: "duplicate",
    categories: [
      category("forecasting", "duplicate"),
      category("signal-processing", "duplicate")
    ]
  }), /duplicate project id/i);
});
