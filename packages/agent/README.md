# packages/agent

Agent Orchestrator、Model Adapter 与首批 deterministic Agent 实现。

当前已包含：

- `SimpleAgentOrchestrator`
- `OpenAICompatibleModelAdapter`
- `StaticModelAdapter`
- `DailyGuideAgent`
- `SufficiencyCheckAgent`

`DailyGuideAgent` 与 `SufficiencyCheckAgent` 是 MVP 阶段的 deterministic fallback，用关键词和规则完成动态追问、信息缺口和主题偏离判断。它们只用于本地闭环与产品验证，不代表真实多 Agent 推理质量。
