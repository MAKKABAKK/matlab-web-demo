(function initMarkdown(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MatlabRepositoryMarkdown = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMarkdown() {
  "use strict";

  function normalizeSource(source) {
    return String(source ?? "").replace(/\r\n?/g, "\n");
  }

  function isBlockStart(line) {
    return /^\s*```/.test(line)
      || /^\s{0,3}#{1,4}\s+/.test(line)
      || /^\s*[-*+]\s+/.test(line)
      || /^\s*\d+[.)]\s+/.test(line)
      || /^\s*>\s?/.test(line);
  }

  function tokenizeMarkdown(source) {
    const lines = normalizeSource(source).split("\n");
    const tokens = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^\s*```\s*([A-Za-z0-9_-]*)\s*$/);
      if (fence) {
        const codeLines = [];
        index += 1;
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        tokens.push({ type: "code", language: fence[1] || "", text: codeLines.join("\n") });
        continue;
      }

      const heading = line.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        tokens.push({ type: "heading", level: heading[1].length, text: heading[2] });
        index += 1;
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        const type = ordered ? "ordered-list" : "unordered-list";
        const pattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
        const items = [];
        while (index < lines.length) {
          const item = lines[index].match(pattern);
          if (!item) break;
          items.push(item[1]);
          index += 1;
        }
        tokens.push({ type, items });
        continue;
      }

      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        const quoteLines = [];
        while (index < lines.length) {
          const quotedLine = lines[index].match(/^\s*>\s?(.*)$/);
          if (!quotedLine) break;
          quoteLines.push(quotedLine[1]);
          index += 1;
        }
        tokens.push({ type: "quote", text: quoteLines.join(" ") });
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      tokens.push({ type: "paragraph", text: paragraph.join(" ") });
    }

    return tokens;
  }

  function appendInlineText(element, text, documentRef) {
    const parts = String(text).split(/(`[^`]+`)/g);
    parts.forEach((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        const code = documentRef.createElement("code");
        code.textContent = part.slice(1, -1);
        element.append(code);
      } else {
        element.append(documentRef.createTextNode(part));
      }
    });
  }

  function renderMarkdown(source, documentRef = document) {
    const container = documentRef.createElement("div");
    container.className = "markdown-body";

    tokenizeMarkdown(source).forEach((token) => {
      if (token.type === "heading") {
        const heading = documentRef.createElement(`h${Math.min(token.level + 2, 6)}`);
        appendInlineText(heading, token.text, documentRef);
        container.append(heading);
      } else if (token.type === "paragraph") {
        const paragraph = documentRef.createElement("p");
        appendInlineText(paragraph, token.text, documentRef);
        container.append(paragraph);
      } else if (token.type === "quote") {
        const quote = documentRef.createElement("blockquote");
        appendInlineText(quote, token.text, documentRef);
        container.append(quote);
      } else if (token.type === "code") {
        const pre = documentRef.createElement("pre");
        const code = documentRef.createElement("code");
        if (token.language) code.dataset.language = token.language;
        code.textContent = token.text;
        pre.append(code);
        container.append(pre);
      } else if (token.type === "ordered-list" || token.type === "unordered-list") {
        const list = documentRef.createElement(token.type === "ordered-list" ? "ol" : "ul");
        token.items.forEach((item) => {
          const row = documentRef.createElement("li");
          appendInlineText(row, item, documentRef);
          list.append(row);
        });
        container.append(list);
      }
    });
    return container;
  }

  return Object.freeze({ normalizeSource, renderMarkdown, tokenizeMarkdown });
});
