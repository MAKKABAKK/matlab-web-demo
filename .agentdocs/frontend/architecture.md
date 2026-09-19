# 前端架构与内容契约

## 产品与信息架构

- 产品是多分类、多独立案例的 MATLAB 机器学习代码仓库。
- 一级导航展示分类，二级导航展示该分类下的独立案例。
- 选中案例后，内容区加载该案例自己的章节、资源与结果。
- 案例章节大纲独立于分类树，只能在当前案例范围内前后导航。
- 网页只加载和展示静态文件，不运行 MATLAB，不提交执行任务。

## 技术组件

- `docs/index.html`：语义化应用壳、全局控件和资源入口。
- `docs/js/content-utils.js`：无 DOM 的 schema 验证、本地化与安全路径规则，
  可由浏览器和 Node.js 测试复用。
- `docs/js/markdown.js`：零依赖的安全 Markdown tokenizer 与 DOM renderer。
- `docs/js/app.js`：分类树、案例与章节路由、异步加载、DOM 渲染、缓存
  和交互状态。
- `docs/css/style.css`：Corporate Trust 设计令牌、分类/案例导航、内容块
  状态与响应式规则。
- `docs/content/catalog.json`：schema 2.2 分类树与案例索引。
- `docs/content/projects/<project-id>/manifest.json`：单个独立案例的章节、
  资源与有序内容块。

## Schema 2.2 导航模型

```text
catalog.categories[]
└── category.projects[]
    └── case manifest
        └── sections[].blocks[]
```

- 分类 ID、案例 ID 和章节 ID 都是稳定 kebab-case。
- 一个案例只能出现在一个分类中。
- manifest ID 必须等于 catalog 中的案例 ID。
- hash 保持 `#/project/<project-id>/section/<section-id>`，分类不写入 hash。
- 无效案例回退到 catalog 默认案例；无效章节回退到该案例第一章节。
- 分类折叠状态属于显示偏好，不得改变当前案例路由。

## 内容块

manifest schema 2.1 的 block 类型为 `text`、`code`、`plot`、`metrics`、
`table`、`callout`、`steps`、`split` 与 `markdown`。`markdown` block 只能
引用当前案例内的本地 `.md` artifact。

一个 block 加载失败时只替换为该 block 的错误卡。一个 manifest 加载
失败时只影响对应案例，分类树和其他案例必须继续可用。

## Markdown 渲染约束

- 允许段落、1–4 级标题、列表、引用、行内代码及 fenced code block。
- 链接和图片语法不属于安全子集，按普通文本显示；内容不得依赖它们加载资源。
- 禁止 HTML、脚本、样式、表单、iframe、事件属性、Markdown 图片、
  远端链接、data URL 与目录穿越。
- 解析结果必须转换为明确的 DOM 节点，文字使用 `textContent`。
- 禁止将解析结果直接赋给 `innerHTML`。
- 不增加第三方 Markdown 包或 CDN。

## 国际化约束

- 支持 `en` 与 `zh-Hant`。
- 英文保留在对象基础字段；繁体中文放在邻接 `i18n.zh-Hant` 同名字段。
- 英文为默认和回退语言，缺失字段只进行逐字段回退。
- 语言偏好写入 URL 和浏览器本地存储，不改变 hash 深链接。
- 切换语言会重新渲染当前章节，并按 `fileByLocale` 载入对应 Markdown。
- HTML 壳文字由统一词典更新；分类、案例和章节文字由 JSON 提供。
- PNG 内 MATLAB 文字保持英文；网页标签、说明与替代文本随语言变化。

## 安全与路径

- JSON 与 manifest 普通文字一律通过 `textContent` 输出。
- 内容 URL 必须同源、相对、位于声明案例内且不含解码后的 `..`。
- 拒绝域名根路径、跨域 URL、协议相对 URL、反斜杠和编码斜杠绕过。
- artifact kind 必须与 block 所要求的 kind 一致。
- 异步分类/案例/章节导航使用令牌，迟到响应不得覆盖当前页面。

## 响应式与无障碍

- 所有交互目标至少 44px。
- 分类标题必须可由键盘展开/收起，并暴露正确的 `aria-expanded`。
- 案例和章节当前项使用 `aria-current`，章节切换后焦点移到内容标题。
- 图表必须提供英文与繁中替代文字。
- 320px 以上不得产生页面级横向滚动；代码、Markdown 代码块与宽表只
  允许各自容器内部滚动。
