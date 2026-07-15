# Scripts

## 验收脚本

### 数据库隔离

所有会写入数据库的 `verify:*` 命令都必须显式传入 `TEST_DATABASE_URL`。库名或 schema 名需包含 `test`、`testing`、`verify`、`verification` 或 `ci`，且不能指向默认的 `digital_self.public`。

## macOS 本机应用

- `corepack pnpm app:install`：生成生产构建和可双击的 `数字原生自我.app`，并复制到当前用户的 Applications 目录。
- `corepack pnpm app:start`：检查依赖、Docker/PostgreSQL、迁移和端口后启动 API/Web；已有完整服务时只打开首页。
- `corepack pnpm app:status`：显示登记进程、端口、健康状态和日志位置。
- `corepack pnpm app:stop`：只停止启动器登记的 API/Web，PostgreSQL 保持运行。

启动信息和日志保存在 `storage/runtime/`。有待执行迁移时，启动器先把数据库备份到 `storage/backups/`，备份失败时不会执行迁移。

```bash
TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/digital_self_verify?schema=public' \
  corepack pnpm verify:daily-entry
```

隔离运行器会自动构建 API、在测试库执行迁移、选择随机本机端口，然后运行检查脚本。缺少测试库连接串，或目标看起来是个人库时，脚本会在写入前退出。

- `corepack pnpm verify:base`：执行最小工程验证，包含 `packages/shared` build、`apps/api` build、`packages/agent` typecheck。MCP 已从当前 MVP 默认验收范围移除。
- `corepack pnpm verify:agent-deterministic`：构建 `packages/agent` 并验证 `DailyGuideAgent` / `SufficiencyCheckAgent` 的 deterministic MVP 输出；只证明本地规则闭环，不代表真实模型推理质量。
- `corepack pnpm verify:all-local`：默认执行开发级快速检查，只跑 build/typecheck、Web build 与 deterministic Agent 验证，避免日常开发被 API/安全/长尾测试拖慢。
- `TEST_DATABASE_URL=... VERIFY_SUITE=full corepack pnpm verify:all-local`：发版或大合并前的全量回归，会在隔离数据库上启动 API，并跑核心业务、外部搜索、项目、简历、文件解析与安全基线。
- `corepack pnpm verify:ci`：执行 GitHub Actions 中的无数据库检查，包含 shared、agent、MCP、API、Web 构建和类型检查，以及 Web Lint、deterministic Agent 与人生星图纯逻辑验证。
- `corepack pnpm verify:api-host`：确认本机单用户模式只接受 `127.0.0.1` 和 `::1`。
- `TEST_DATABASE_URL=... corepack pnpm verify:web-ui-smoke`：自动启动隔离 API 和生产构建 Web，验证主要页面与写入闭环。
- `TEST_DATABASE_URL=... corepack pnpm verify:home-states`：在空测试库上检查首页空状态，并模拟 API 中断，确认不会用样例人生数据填充页面。
- `TEST_DATABASE_URL=... corepack pnpm verify:evidence-event-archive`：验证历史文件原件落盘、解析版本、原始文本、引用片段、候选事件、人工确认、正式事件、候选记忆和版本历史的 API 闭环。
- `TEST_DATABASE_URL=... corepack pnpm verify:archive-ui`：通过生产构建页面完成“上传历史文件 → 保存原始资料 → 候选事件 → 确认 → 时间线查看来源 → 候选记忆确认 → 星图检索”。
- `TEST_DATABASE_URL=... corepack pnpm verify:archive-restore`：在隔离数据库执行新旧 ZIP 的导出恢复、replace/merge、用户映射、文件哈希、损坏包、路径穿越、缺失文件与事务回滚验收。
- `TEST_DATABASE_URL=... corepack pnpm verify:app-runtime`：使用隔离数据库和临时端口验收首次/重复启动、异常退出恢复、端口冲突、登记进程停止及 PostgreSQL 保持运行。
- `TEST_DATABASE_URL=... corepack pnpm verify:data-control`：验证外部处理默认拒绝、处理位置说明、`digital-self-archive/v1` JSON 和原件 ZIP 打包。
- `TEST_DATABASE_URL=... corepack pnpm verify:data-control-ui`：通过生产构建页面检查“数据与隐私”，并下载、解析完整档案包。
- `TEST_DATABASE_URL=... corepack pnpm verify:graph-relations`：验证人工关系的归属校验、创建、修改、删除和 `asOf` 有效期过滤。
- `TEST_DATABASE_URL=... corepack pnpm verify:graph-relations-ui`：通过生产构建页面建立两个事件的关系，并在不同日期回看关系出现与消失。
- `TEST_DATABASE_URL=... corepack pnpm verify:people-graph`：验证人物归属、人物星图节点、人物关系和删除清理。
- `TEST_DATABASE_URL=... corepack pnpm verify:people-ui`：通过人物页面创建记录，再到 3D 人生星图搜索该人物。
- `TEST_DATABASE_URL=... corepack pnpm verify:event-participants`：验证事件参与者归属、来源继承、有效时间和 3D 星图关系。
- `TEST_DATABASE_URL=... corepack pnpm verify:event-participants-ui`：通过时间线添加人物参与事件，再在 3D 人生星图查看人物与事件连线。
- `TEST_DATABASE_URL=... corepack pnpm verify:planning-graph`：验证目标、计划、里程碑、行动的层级归属、状态更新、删除清理和星图关系。
- `TEST_DATABASE_URL=... corepack pnpm verify:planning-ui`：通过未来指南针页面创建四层规划并在 3D 人生星图查看。
- `corepack pnpm verify:ability-evidence`：在隔离 API 中创建能力节点和候选能力证据，验证列表筛选、详情、能力树挂载、review、删除与 404。
- `corepack pnpm verify:daily-entry`：在隔离 API 中验证 DailyEntry 的创建、详情查询和列表分页契约。
- `corepack pnpm verify:structured-daily-report`：假设 API 已运行在本地，先创建 DailyEntry，再验证 StructuredDailyReport 的创建、按 `dailyEntryId` 查询、DailyEntry 详情回填，以及重复创建返回 `409`。
- `corepack pnpm verify:memory-review`：假设 API 已运行在本地，验证 `POST/GET/PATCH review/DELETE /api/memories`，并通过 Prisma 校验 `MemoryVersion` 版本历史写入。
- `corepack pnpm verify:memory-rag`：启动或复用本地 API，验证 deterministic token RAG fallback 能检索 confirmed memories，并且不会返回 candidate/rejected 记忆。
- `corepack pnpm verify:resume-documents`：启动或复用本地 API，验证 `POST /api/resume-documents/text`、`POST /api/resume-documents/file`、`GET list/detail`、`PATCH title/isPrimary`、主简历唯一性、空文本 `400`、PDF / DOCX 正向解析、旧 `.doc` 解析限制 `422`，以及 `DELETE` 后 `404`。
- `corepack pnpm verify:resume-materials`：假设 API 已运行在本地，验证 `POST /api/resume-materials/extract-candidates` 的四类来源候选提取、幂等去重、候选默认 `candidate`、不会自动创建 Project，以及 `GET list/detail`、`PATCH review`、手动 `POST`、非法来源 `404`、非法 `confidence/limitPerSource` 返回 `400`、`DELETE` 后 `404`。
- `corepack pnpm verify:resume-gap-analysis`：启动隔离构建版 API，验证 `POST /api/resume-gap-analysis` 的 deterministic 目标岗位差距分析：JD 要求提取、已确认项目 / 素材 / 能力证据匹配、candidate 不计入匹配、缺口项生成、无 JD 时岗位模板 fallback、空 `targetRole` 返回 `400`。
- `corepack pnpm verify:project-packaging-suggestions`：假设 API 已运行在本地，验证 `POST /api/project-packaging-suggestions` 的 deterministic 项目包装建议：指定 / 未指定项目、已确认素材与能力证据进入证据快照、candidate 不进入正式建议证据、缺失项目 `404`、空 `targetRole` 返回 `400`。
- `corepack pnpm verify:security-baseline`：启动或复用本地 API，验证基础安全边界：未知 CORS origin 被拒绝且返回 requestId、非法 `x-request-id` 不被回显、404 使用统一错误信封。
- `corepack pnpm verify:external-source-search`：默认会用 `EXTERNAL_SOURCE_SEARCH_PROVIDER=fake` 启动或复用 API，验证 `POST /api/external-sources/search` 搜索保存、列表可查、可不关联 decision，以及空 query / 非法 limit / 缺失 decision 边界。
- `corepack pnpm verify:external-source-impact-draft`：启动或复用本地 API，验证 `POST /api/external-sources/impact-draft` 只生成 deterministic 候选草稿、不自动写入 `DecisionEvidence`、warning 明确披露需人工确认，以及用户确认后才可通过正式证据 API 落库，并保留 `sourceCitationId / SourceCitation` 追溯链路。
- `corepack pnpm verify:weekly-reviews`：启动或复用本地 API，验证 Weekly Review 后端 deterministic `generate/latest/by-period` 闭环：同周幂等、空周数据边界、`sourceSnapshot` 统计，以及当前唯一维度 `userId + periodStart + periodEnd`。该脚本只证明可重复汇总，不代表真实 AI 深度分析质量。
- `corepack pnpm verify:web-ui-smoke`：复用已运行的 Web/API，打开 `/`、`/daily-entry/today`、`/memories/review`、`/ability-tree`、`/weekly-review`、`/external-sources`、`/projects` 做当前范围 smoke；`/weekly-review` 已按真实 API 页面验收，不再是 mock/sample 页面；`/external-sources` 已覆盖 fake provider 搜索保存、路径影响草稿、确认前不落库、确认后写入 `DecisionEvidence` 并回显 `sourceCitationId` / 来源追溯。最近一次证据目录见 `specs/digital-self-mvp/test-evidence/` 下最新 `web-ui-smoke-*`。

## 环境变量

- `TEST_DATABASE_URL`：必填的隔离验证库连接串。
- `TEST_DIRECT_URL`：可选；必须与 `TEST_DATABASE_URL` 指向同一个库和 schema。

- `DAILY_ENTRY_API_BASE_URL`：覆盖 `verify:daily-entry` 默认 base URL。
- `ABILITY_EVIDENCE_API_BASE_URL`：覆盖 `verify:ability-evidence` 默认 base URL。
- `STRUCTURED_REPORT_API_BASE_URL`：覆盖 `verify:structured-daily-report` 默认 base URL。
- `MEMORY_REVIEW_API_BASE_URL`：覆盖 `verify:memory-review` 默认 base URL。
- `RESUME_DOCUMENTS_API_BASE_URL`：覆盖 `verify:resume-documents` 默认 base URL。
- `RESUME_MATERIALS_API_BASE_URL`：覆盖 `verify:resume-materials` 默认 base URL。
- `RESUME_GAP_ANALYSIS_API_BASE_URL`：覆盖 `verify:resume-gap-analysis` 默认 base URL。
- `PROJECT_PACKAGING_SUGGESTIONS_API_BASE_URL`：覆盖 `verify:project-packaging-suggestions` 默认 base URL。
- `SECURITY_BASELINE_API_BASE_URL`：覆盖 `verify:security-baseline` 默认 base URL。
- `EXTERNAL_SOURCE_SEARCH_API_BASE_URL`：覆盖 `verify:external-source-search` 默认 base URL。
- `EXTERNAL_SOURCE_IMPACT_DRAFT_API_BASE_URL`：覆盖 `verify:external-source-impact-draft` 默认 base URL。
- `WEEKLY_REVIEWS_API_BASE_URL`：覆盖 `verify:weekly-reviews` 默认 base URL。
- `WEB_UI_SMOKE_WEB_BASE_URL`：覆盖 `verify:web-ui-smoke` 默认 Web base URL。
- `WEB_UI_SMOKE_API_BASE_URL`：覆盖 `verify:web-ui-smoke` 默认 API base URL。
- `WEB_UI_SMOKE_HEADLESS`：传 `false` 时以有头模式运行 `verify:web-ui-smoke`。
- `EXTERNAL_SOURCE_SEARCH_PROVIDER`：后端外部搜索 provider，支持 `duckduckgo` 与 `fake`；本地自动化建议使用 `fake`，真实使用默认 `duckduckgo` best-effort web search。
- `VERIFY_ALL_API_BASE_URL`：显式指定 `verify:all-local` 要复用或启动的 API base URL；未设置时，统一入口会自行选择临时本地端口。
- `VERIFY_SUITE`：控制 `verify:all-local` 的范围，默认 `quick`；传 `full` 时运行全量长尾验收。
- `API_BASE_URL`：未设置 `DAILY_ENTRY_API_BASE_URL` 时的兼容回退。
