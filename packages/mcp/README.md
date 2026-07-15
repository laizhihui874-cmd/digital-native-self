# packages/mcp

数字原生自我项目的 MCP server 包。

当前包含：
- 现有 `createDigitalSelfMcpServer` 业务无关封装
- 工具 schema 与输入校验
- 第一批只读业务 handler（API 驱动）
- 外部信息搜索 handler（API 驱动，保存 ExternalSource）
- 官方 MCP SDK 的 stdio transport 启动入口

当前不包含：
- 飞书发送、简历解析
- DB 直连

## Build

```bash
corepack pnpm --filter @digital-self/mcp typecheck
corepack pnpm --filter @digital-self/mcp build
corepack pnpm --filter @digital-self/mcp smoke
```

## Start over stdio

stdio 入口默认注册第一批只读 API handler。默认 API base URL 为 `http://localhost:3001`。

可用环境变量：

- `DIGITAL_SELF_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`（兼容复用）

先构建：

```bash
corepack pnpm --filter @digital-self/mcp build
```

然后启动：

```bash
corepack pnpm --filter @digital-self/mcp start:stdio
```

也可以直接把构建产物作为 MCP command：

```bash
node packages/mcp/dist/stdio.js
```

## Programmatic factory

```ts
import { createDigitalSelfMcpServerWithApiHandlers } from "@digital-self/mcp";

const server = createDigitalSelfMcpServerWithApiHandlers({
  apiBaseUrl: "http://localhost:3001",
});
```

当前默认实现的只读 tools：

- `read_memories`
- `list_daily_entries`
- `list_ability_nodes`
- `get_life_decision`
- `get_latest_weekly_review`
- `get_weekly_review_by_period`

当前默认实现的写入 / 搜索 tools：

- `create_memory_candidate`
- `create_ability_evidence_candidate`
- `generate_weekly_review`
- `create_decision_evidence`
- `search_external_sources`

`search_external_sources` 会调用 `POST /api/external-sources/search` 并保存来源。结果仍是 best-effort source links and snippets，不代表权威研究结论；重要信息必须打开 URL 人工核对。

WeeklyReview 相关 MCP tools 调用：

- `POST /api/weekly-reviews/generate`
- `GET /api/weekly-reviews/latest?lifeDecisionId?`
- `GET /api/weekly-reviews?periodStart=...&periodEnd=...&lifeDecisionId?`

这些返回的是 deterministic 周复盘汇总，不代表真实 AI 深度分析。当前后端唯一维度仍是 `userId + periodStart + periodEnd`，因此同一周不能按多个 `lifeDecisionId` 并存多份周复盘。

`create_decision_evidence` 当前支持可选 `externalSourceId`。当传入已保存的 ExternalSource 时，API 会校验归属，并创建或复用对应的 SourceCitation，再把 `sourceCitationId` 写回正式 evidence。MCP 目前还不支持把任意 `sourceCitations[]` 明细直接映射到 REST 请求体，因此应优先使用 `externalSourceId`。

当前未暴露的 MCP tools / 流程：

- External source impact draft：API 只会生成候选草稿，不会自动入档；正式入档仍需要用户确认，MCP 暂未封装这条确认链路。

当前仍保持 `NOT_IMPLEMENTED` 的 tools：

- `send_feishu_message`
- `parse_resume_file`
