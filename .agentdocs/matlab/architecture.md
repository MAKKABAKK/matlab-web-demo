# MATLAB 案例与发布架构

> **LEGACY / OPTIONAL：** 本文只描述冻结的 V1 MATLAB pipeline。V2 正常
> 发布以 `projects/` 为 source of truth，由 Cloud Publisher 整理现成 `.m`
> 与图片，不运行本目录任何入口。

## 产品边界

- MATLAB 目录提供机器学习代码仓库中的独立可运行案例。
- 每个案例独立生成数据、指标、图表和源码副本。
- 分类归属由 schema 2.2 catalog 管理，不写入 MATLAB 算法函数。
- V1 MATLAB 可在本地手动运行；V2 CI 与网页均不运行 MATLAB。

## 目录职责

- `matlab/main.m`：既有客流预测案例入口，保持向后兼容。
- `matlab/run_all.m`：一次生成全部独立案例。
- `matlab/projects/<case-folder>/`：新增案例的唯一命名入口、数据函数、
  分析函数与绘图函数。
- `matlab/demo_project_paths.m`：从文件位置推导仓库与案例输出路径。
- `matlab/publish_project.m`：统一导出图表、写 JSON、复制源码，并更新
  manifest/catalog 元数据。
- `matlab/style_demo_axes.m`：共享图表坐标轴样式。
- `matlab/export_demo_figure.m`：PNG 导出及旧版 MATLAB 回退逻辑。
- `matlab/tests/validate_all.m`：发布后源码、JSON 与 PNG 验证。

MATLAB 目录名使用下划线以符合函数命名习惯；网页案例 ID 使用稳定的
kebab-case。两者通过项目 config 明确映射。

## 案例约束

- 仅使用基础 MATLAB，不依赖额外工具箱。
- 含随机数据的案例必须固定 `rng`，保证结果可复现。
- 每个入口和辅助函数必须具有跨案例唯一名称，避免 MATLAB path 冲突。
- 每个入口使用 `mfilename('fullpath')` 推导路径，不依赖当前工作目录。
- 数值结果必须由代码计算，不得在网页或 manifest 中写死。
- 每个案例至少发布 `results.json`、核心 `.m` 源码和必要 PNG。
- 单文件不超过 1000 行，新增注释使用简明中文。

## 公共发布接口

案例 config 向 `publish_project` 提供：

```text
id
title
sourceDir
sourceFiles
buildFunction
```

`buildFunction` 返回：

```text
bundle.results
bundle.figures(i).file
bundle.figures(i).handle
```

公共发布器负责：

1. 建立该案例的 `data`、`plots` 与 `code` 目录。
2. 导出全部 figure，并在成功或失败后关闭图窗。
3. 以 UTF-8 写入 `results.json`。
4. 复制 config 声明的源码。
5. 更新该案例 manifest 的 `version` 与 `lastUpdated`。
6. 在 `catalog.categories[].projects[]` 中查找相同 ID 并更新时间。
7. 使用 `jsondecode/jsonencode` 修改 JSON，同时保留 `zh-Hant` 等原始键。

发布器不得改变案例所属分类、manifest 章节顺序或内容块配置。

## 输出契约

```text
docs/content/projects/<project-id>/
├── manifest.json
├── data/results.json
├── code/*.m
├── plots/*.png
└── docs/*.md            # 可选，由案例内容维护
```

- manifest 是单个案例的完整内容声明。
- artifact 路径必须留在当前案例目录，禁止跨案例引用。
- MATLAB 不生成或解释 Markdown；它只维护计算产物和发布元数据。
- Markdown 文件如需由发布流程复制，必须通过明确的案例配置扩展实现，
  不得混入算法结果 JSON。

## 运行与验证

生成全部案例：

```matlab
addpath('matlab');
run_all
```

验证全部发布结果：

```matlab
run('matlab/tests/validate_all.m')
```

修改 MATLAB 后还必须对所有 `.m` 文件运行 `checkcode`。完整发布应验证：

- 每个 config 声明的源码均已复制；
- 每个 figure 文件存在、非空并可由 `imfinfo` 读取；
- `results.json` 可由 `jsondecode` 读取且关键数值有限；
- manifest 与 catalog 时间已更新且分类归属未改变；
- 连续运行结果除发布时间外保持确定性。

## 新增案例检查表

1. 建立具有唯一函数名的 MATLAB 案例目录。
2. 定义 config、build function、结果结构和图表文件名。
3. 建立独立 manifest，并将 artifact 文件名与输出严格对齐。
4. 在 schema 2.2 catalog 的一个分类中注册案例。
5. 将入口加入 `run_all`，但不复制公共发布逻辑。
6. 执行完整发布、MATLAB 验证和浏览器内容测试。
