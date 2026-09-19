# AI 代理文档索引

> **最高优先级产品记忆：本项目是多分类、多独立案例的 MATLAB 机器学习代码仓库，不是教学用具、单项目教程或课时制课件。此前相反理解已被完全废止。**

## 全局关键记忆

- 本项目是无需构建步骤的静态 MATLAB 代码案例仓库，部署目标是 GitHub Pages 的 `main /docs`。
- HTML 只提供应用壳；模型分类、独立案例、案例章节、代码、图表、指标与表格由 JSON 内容契约驱动。
- 一级目录是模型分类，二级条目是互相独立的案例；案例章节是当前案例的内容导航，不是课程课时。
- 网页只负责文档导航与静态展示，绝不在浏览器执行 MATLAB。
- 项目保持零第三方依赖，测试使用 Node.js 内置能力，MATLAB 示例仅使用基础函数。
- 本地化以英文基础字段加邻接 `i18n.zh-Hant` 覆盖实现；稳定 ID、数据键与文件路径不参与翻译。
- 所有 URL 相对于声明资源的 JSON 文件解析，禁止域名根路径、跨域路径及父目录路径。

## 前端文档

- [frontend/architecture.md](frontend/architecture.md) — 仓库前端架构、分类树、案例渲染、国际化与路径约束；修改 HTML、CSS、JavaScript 或 manifest 时必读。

## MATLAB 文档

- [matlab/architecture.md](matlab/architecture.md) — 独立 MATLAB 案例目录、共享发布流程与输出契约；新增或修改案例时必读。

## 当前任务文档

- [workflow/260917-convert-to-code-repository.md](workflow/260917-convert-to-code-repository.md) — 将旧教学定位彻底改造为模型分类下的独立代码案例仓库；本轮迭代期间必读并维护阶段状态。
