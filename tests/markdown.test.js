"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeSource, tokenizeMarkdown } = require("../docs/js/markdown.js");

test("Markdown 標題與跨行段落會轉成穩定 token", () => {
  assert.deepEqual(tokenizeMarkdown("# Case summary\n\nFirst line\nsecond line"), [
    { type: "heading", level: 1, text: "Case summary" },
    { type: "paragraph", text: "First line second line" }
  ]);
});

test("Markdown 有序與無序清單會保留項目順序", () => {
  assert.deepEqual(tokenizeMarkdown("- Alpha\n- Beta\n\n1. Fit\n2. Evaluate"), [
    { type: "unordered-list", items: ["Alpha", "Beta"] },
    { type: "ordered-list", items: ["Fit", "Evaluate"] }
  ]);
});

test("Markdown 程式碼圍欄保留語言與原始縮排", () => {
  const source = "```matlab\nfor index = 1:2\n    disp(index);\nend\n```";
  assert.deepEqual(tokenizeMarkdown(source), [{
    type: "code",
    language: "matlab",
    text: "for index = 1:2\n    disp(index);\nend"
  }]);
});

test("Markdown 中的 HTML 只會成為普通文字", () => {
  const html = "<img src=x onerror=alert(1)> <script>alert('x')</script>";
  assert.deepEqual(tokenizeMarkdown(html), [{ type: "paragraph", text: html }]);
});

test("Markdown 換行正規化不改變內容語義", () => {
  assert.equal(normalizeSource("Alpha\r\nBeta\rGamma"), "Alpha\nBeta\nGamma");
});
