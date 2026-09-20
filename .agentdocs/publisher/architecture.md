# Cloud Publisher 架构

## 产品边界

V2 维护者只在 GitHub 上传 `projects/<project-id>/`。Cloud Publisher 不执行
MATLAB、不生成分析结果、不使用外部 API，也不要求维护者编辑 JSON。

`projects/` 是 V2 source of truth；`docs/content/` 是 Catalog 2.2 / Manifest
2.1 格式的发布输出。现有四个 V1 案例不在 `projects/` 中，由 builder 原样
保留。

## 输入契约

- project ID 等于目录名，必须是 lowercase ASCII kebab-case。
- `README.md` 第一处围栏外 H1 是 title，其后正文折叠空白后成为可空的
  description。
- 第一层至少有一个非空 UTF-8 `.m` 和一个通过结构及 signature 验证的
  `.png`、`.jpg` 或 `.jpeg`。
- 忽略隐藏文件和其他普通文件；拒绝 symlink 与嵌套目录。
- 代码和图片分别按大小写不敏感的 natural filename order 排序。

## 构建与安全

1. 扫描并验证全部 source project。
2. 复制完整 `docs/content` 到同文件系统的临时 staging。
3. 保留 V1 category/project/order/i18n/defaultProject。
4. 在 `published-projects` 中 CREATE/UPDATE V2 entries。
5. 生成两个 section：图片 `Overview` 与代码 `Source Code`。
6. 验证 staging 中完整 catalog、manifest、artifact 与图片。
7. 内容有变化时用备份和同文件系统 rename 安全替换。

任何失败发生在真实内容替换前。已发布 V2 source 缺失会失败，MVP 不自动
删除。version 是 source content hash；source 未变时沿用 lastUpdated，因此
重复构建结果稳定。

## GitHub Actions

PR 只构建和测试。`main` push 构建、测试、上传 Pages artifact；成功后仅将
generated content 回写 main，并部署同一次测试通过的 artifact。回写前检查
`origin/main` 仍是触发 SHA，不 force push，不使用 PAT，bot commit 用
`[skip ci]` 避免循环。
