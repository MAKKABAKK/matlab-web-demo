"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const navigation = require("../docs/js/navigation-utils.js");

test("分類展開狀態只恢復目前 catalog 中的有效 ID", () => {
  const restored = navigation.parseExpandedCategories(
    JSON.stringify(["models-a", "removed", "models-b", 17]),
    ["models-a", "models-b"]
  );
  assert.deepEqual([...restored], ["models-a", "models-b"]);
  assert.deepEqual([...navigation.parseExpandedCategories("broken-json", ["models-a"])], []);
  assert.deepEqual([...navigation.parseExpandedCategories('{"not":"an array"}', ["models-a"])], []);
});

test("多個分類可以同時展開、獨立收合並穩定序列化", () => {
  let expanded = navigation.setCategoryExpanded(new Set(), "models-b", true);
  expanded = navigation.setCategoryExpanded(expanded, "models-a", true);
  assert.deepEqual([...expanded], ["models-b", "models-a"]);
  assert.equal(navigation.serializeExpandedCategories(expanded), '["models-a","models-b"]');
  expanded = navigation.setCategoryExpanded(expanded, "models-b", false);
  assert.deepEqual([...expanded], ["models-a"]);
});

test("深层链接只确保目标分类可见，不收合其他分类", () => {
  const expanded = navigation.ensureCategoryExpanded(new Set(["models-a"]), "models-b");
  assert.deepEqual([...expanded], ["models-a", "models-b"]);
});

test("manifest promise cache 去重请求并在失败后允许重试", async () => {
  const cache = navigation.createAsyncCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return { sections: [1, 2] };
  };
  const [first, second] = await Promise.all([cache.get("case", loader), cache.get("case", loader)]);
  assert.equal(calls, 1);
  assert.equal(first, second);

  let attempts = 0;
  await assert.rejects(cache.get("failure", async () => {
    attempts += 1;
    throw new Error("temporary");
  }));
  await cache.get("failure", async () => {
    attempts += 1;
    return "recovered";
  });
  assert.equal(attempts, 2);
});

test("应用树的数量来自 manifest，不再读取 catalog topic", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "docs", "js", "app.js"), "utf8");
  assert.match(source, /sectionCounts\.get\(project\.id\)/);
  assert.doesNotMatch(source, /field\(project,\s*["']topic["']\)/);
});

test("分类、案例、路由与 current 状态全部由现有 catalog 导航扩展", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "docs", "js", "app.js"), "utf8");
  assert.match(source, /state\.catalog\.categories\.map/);
  assert.match(source, /category\.projects\.forEach/);
  assert.match(source, /String\(category\.projects\.length\)/);
  assert.match(source, /link\.href = projectRoute\(project\.id\)/);
  assert.match(source, /window\.addEventListener\("hashchange"/);
  assert.match(source, /link\.setAttribute\("aria-current", "page"\)/);
  assert.match(source, /state\.manifest\.sections\.map/);
});

test("section count 本地化、失败隔离与并发去重路径存在", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "docs", "js", "app.js"), "utf8");
  const content = fs.readFileSync(path.join(__dirname, "..", "docs", "js", "content-utils.js"), "utf8");
  assert.match(content, /"sections\.count": "\{count\} sections"/);
  assert.match(content, /"sections\.count": "\{count\} 節"/);
  assert.match(app, /Promise\.allSettled/);
  assert.match(app, /sectionCountFailures/);
  assert.match(app, /sectionCountPending/);
  assert.match(app, /manifestCache\.get/);
});

test("导航 CSS 支持长标题、移动端、滚动和键盘焦点", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "docs", "css", "style.css"), "utf8");
  assert.match(css, /\.sidebar\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.category-toggle strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(css, /\.case-link-copy strong[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /\.category-projects\s*\{[\s\S]*?border-left:/);
});
