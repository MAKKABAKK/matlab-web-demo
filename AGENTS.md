# 项目开发约束

## 产品定义

- 本项目是“多分类、多独立案例的 MATLAB 机器学习代码仓库”。
- 信息架构固定为“分类树 → 独立案例 → 案例章节”。
- 分类负责发现与分组；manifest 只描述一个独立案例。
- 网页只导航和展示静态文件，绝不运行 MATLAB，也不提供远端执行服务。
- 新功能必须保持分类优先、案例独立且可非线性浏览的结构。

## 技术边界

- 仅使用 MATLAB、HTML、CSS、原生 JavaScript、JSON 与本地 Markdown。
- 不引入 npm 包、前端框架、CDN、后端、数据库或远端内容。
- 网页资源必须使用相对路径，并可部署到 GitHub Pages 仓库子路径。
- 单个代码文件不得超过 1000 行；接近上限时按职责拆分。
- 新增代码注释使用简明专业的中文。

## Schema 2.2 内容契约

- catalog 使用 `categories[].projects[]` 表达分类与案例归属。
- 分类、案例、章节与资源 ID 使用稳定 kebab-case，不因翻译或标题变化。
- 每个案例只能属于一个分类，并拥有独立 manifest 和资源目录。
- 案例章节只在当前案例内导航，不构成分类树的下一级分类。
- 用户可见内容优先由 catalog/manifest 驱动，不在 HTML 复制案例文案。
- 英文保留在基础字段；繁体中文放在同一对象的 `i18n.zh-Hant`。
- 英文是回退语言；缺少当前语言字段时逐字段回退英文。
- 稳定 ID、文件路径、数据键、block 类型和派生规则不得翻译。

## Markdown 安全边界

- `markdown` artifact 只能引用当前案例目录内的 `.md` 文件。
- `markdown` block 只能使用受控的本地安全子集。
- 禁止原始 HTML、脚本、样式、表单、iframe、事件属性与 Markdown 图片。
- 禁止远端、协议相对、data URL、绝对路径、反斜杠及任何目录穿越。
- 渲染器必须创建 DOM 节点并使用 `textContent`，不得注入未经净化的
  `innerHTML`。

## 必须执行的验证

每次修改前端或内容契约后执行：

```bash
node --check docs/js/content-utils.js
node --check docs/js/app.js
node --test tests/*.test.js
python3 tests/http_smoke.py
```

每次修改 MATLAB 后，在已安装 MATLAB 的环境执行：

```matlab
addpath('matlab');
run_all
run('matlab/tests/validate_all.m')
```

并使用 `checkcode` 检查全部 `.m` 文件。若 MATLAB 不在终端 PATH 中，
使用本机 MATLAB 应用的 `bin/matlab`。

## 浏览器验收

- 至少检查桌面端 1440×900 与手机端 390×844。
- 验证分类展开、案例切换、案例章节、繁中/英文、深链接与刷新。
- 验证 PNG、Markdown、MATLAB 源码、结果表格和复制功能。
- 页面不得横向溢出，控制台不得出现未处理错误。
- 快速切换案例时，迟到请求不得覆盖当前选择。
