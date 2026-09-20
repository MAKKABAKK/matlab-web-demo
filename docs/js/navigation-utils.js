(function initNavigationUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MatlabRepositoryNavigation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createNavigationUtils() {
  "use strict";

  const STORAGE_KEY = "matlab-code-repository.expanded-categories";

  function parseExpandedCategories(serialized, validCategoryIds) {
    const valid = new Set(validCategoryIds || []);
    try {
      const values = JSON.parse(serialized || "[]");
      if (!Array.isArray(values)) return new Set();
      return new Set(values.filter((value) => typeof value === "string" && valid.has(value)));
    } catch {
      return new Set();
    }
  }

  function serializeExpandedCategories(expandedCategories) {
    return JSON.stringify([...expandedCategories].sort());
  }

  function setCategoryExpanded(expandedCategories, categoryId, expanded) {
    const next = new Set(expandedCategories);
    if (expanded) next.add(categoryId);
    else next.delete(categoryId);
    return next;
  }

  function ensureCategoryExpanded(expandedCategories, categoryId) {
    return categoryId ? setCategoryExpanded(expandedCategories, categoryId, true) : new Set(expandedCategories);
  }

  function createAsyncCache() {
    const values = new Map();
    return {
      get(key, loader) {
        if (!values.has(key)) {
          const pending = Promise.resolve().then(loader);
          values.set(key, pending);
          pending.catch(() => {
            if (values.get(key) === pending) values.delete(key);
          });
        }
        return values.get(key);
      },
      clear() {
        values.clear();
      }
    };
  }

  return Object.freeze({
    STORAGE_KEY,
    createAsyncCache,
    ensureCategoryExpanded,
    parseExpandedCategories,
    serializeExpandedCategories,
    setCategoryExpanded
  });
});
