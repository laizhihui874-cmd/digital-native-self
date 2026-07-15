# Chronolabe

> **Your life, traceable. Your future, navigable.**<br>
> 让人生可以追溯，让未来可以推演。

[![CI](https://github.com/laizhihui874-cmd/chronolabe/actions/workflows/ci.yml/badge.svg)](https://github.com/laizhihui874-cmd/chronolabe/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Local First](https://img.shields.io/badge/local--first-yes-2ea44f.svg)](#数据主权与-ai-边界)

**Chronolabe（数字原生自我）** 是一个开源、本地优先的人生档案馆与未来指南针。它把散落的日记、文件、事件、人物、记忆、项目、决定和计划连接起来，形成一张可以回到原始记录的 3D 人生星图；AI 在这份档案之上帮助你回顾、理解和规划，但不会替你决定什么是真实的。

Chronolabe 这个名字由 **chronology**（时间记录）和 **astrolabe**（通过星象辨认位置与方向的仪器）组合而来：我们希望它既能保存一个人走过的路，也能帮助人看清下一步往哪里走。

## 为什么要做 Chronolabe

人的数字生活通常被拆散在日记、聊天记录、文档、任务软件、相册和各类平台里。它们保存了大量事实，却很难回答这些问题：

- 一段长期记忆最早来自哪条记录？
- 某个重要决定受哪些人、事件和项目影响？
- 我说自己具备某项能力，有哪些真实经历可以支持？
- 过去的计划后来发生了什么，我为什么改变方向？
- 面对新的选择，哪些档案是证据，哪些只是当下的猜测？

Chronolabe 想建立的不是另一个笔记软件，也不是一个替用户下结论的聊天机器人，而是一套属于个人自己的数字基底：

```text
原始记录
   ↓ 可验证、可定位
人生档案
   ↓ 人物、事件、记忆与决定互相连接
3D 人生星图
   ↓ 回顾规律、发现缺口、理解变化
未来指南针
   ↓ 比较路径、提出验证行动、持续复盘
新的真实记录
```

## 最终愿景

### 1. 人生档案馆

长期保存一个人的重要原始资料、事件、人物、记忆、能力、项目与决定。每个结论都尽量保留来源、时间、版本和上下文，让多年后的自己仍能知道“这件事为什么会被记录成这样”。

### 2. 记忆星图

记忆不是一排孤立的文档。事件会连接人物，项目会证明能力，经历会影响决定，旧目标也会改变后来的方向。Chronolabe 用可交互的 3D 图展示这张人生关系网，并支持局部探索、时间回看和来源追溯。

### 3. 未来指南针

规划不只是列任务。未来的 Chronolabe 会结合目标、现实进展、支持材料、反例和仍不确定的判断，帮助用户比较候选路径，提出下一步验证行动，并记录计划为什么被修改。AI 提供分析，决定仍由用户作出。

### 4. 可以共同成长的个人 AI

我们会借鉴长期运行 Agent 的会话留存、分层记忆、技能、工具边界与定时整理机制，但重点不是打造一个可以随意操作电脑的通用 Agent，而是让 AI 成为人生档案的整理员、研究助手和规划伙伴。它读到什么、引用什么、建议写入什么，都应该可以检查和撤回。

## 当前已经实现

项目仍在早期开发阶段，下面这些能力已经进入代码并通过自动化检查。

| 模块 | 当前能力 |
| --- | --- |
| 人生档案 | 导入 PDF、DOCX、TXT、Markdown 或粘贴文本；保存原始资料、解析版本与可引用片段 |
| 事件与时间线 | 从资料建立事件候选，确认后进入正式时间线，并可返回原始来源 |
| 人物与关系 | 建立人物档案、事件参与关系和带有效时间的人工关系 |
| 长期记忆 | 保存候选与已确认记忆，并保留事件、资料片段等来源关系 |
| 项目与能力 | 管理项目经历、能力树与能力证据，连接相关经历 |
| 人生决定 | 记录重要决定，并在星图中查看它与其他档案的关系 |
| 未来规划 | 使用目标 → 计划 → 里程碑 → 行动四层结构管理未来事项 |
| 3D 人生星图 | 展示事件、人物、记忆、项目、能力、决定和规划节点；支持搜索、类型筛选、局部关系深度、时间过滤与历史回看 |
| AI 档案助手 | 本机搜索相关档案，调用 OpenAI 兼容模型流式回答，使用 `[[S1]]` 等受控引用回到真实来源 |
| 统一待确认区 | 集中审核事件 Proposal、候选记忆和能力证据；支持筛选、重复标记、批量确认、批量拒绝与受限制撤销 |
| 数据控制 | 导出完整 ZIP 档案，执行恢复预检、合并时跳过冲突或整库替换；替换前自动备份 |
| macOS 启动器 | 安装可双击的 `.app`，检查 Docker、数据库迁移、API 和 Web 服务，并记录本机运行状态 |

### 现在可以怎样使用它

- 把旧日记和历史文件导入档案馆，整理为事件和长期记忆。
- 从一件事出发，在 3D 星图中查看相关人物、决定、能力和项目。
- 询问“过去哪些经历支持我做这个选择”，并逐条打开 AI 使用的来源。
- 把目标拆成计划、里程碑和行动，再和已有经历建立关系。
- 批量审核 AI 或规则生成的候选内容，确认前不污染正式档案。
- 导出一份包含数据库记录与原始文件的个人档案包，并在需要时恢复。

## 设计原则

- **本机优先**：数据库、上传文件、对话和运行日志默认留在自己的电脑上。
- **来源优先**：重要事件、记忆和 AI 回答尽量能够回到原始片段。
- **确认优先**：AI 只产生建议或候选，不直接改写正式人生档案。
- **关系来自事实**：星图中的正式连线来自数据库关系或用户确认；视觉距离和聚类不被当作人生结论。
- **历史可以回看**：资料解析、事件内容和关系变化保留版本或有效时间。
- **可以带走**：个人资料支持导出、核对和恢复，不把人生锁在单一平台里。

## 数据主权与 AI 边界

AI 默认关闭。只有用户配置模型服务、保存 API 密钥并同意云端处理后，软件才会发起外部请求。

一次档案问答最多发送：

- 当前问题；
- 最近 6 条对话消息；
- 最多 8 条相关档案片段，总长度约 1.2 万字。

API 密钥保存在 macOS 钥匙串，不写入个人数据库、日志、API 响应或档案导出包。检索片段会被标记为不可信资料，问答模型没有系统工具，也不能直接创建正式事件、记忆、关系或规划。用户可以随时撤销权限并删除 AI 设置、调用记录和本机对话。

当前检索使用领域数据的实时文本搜索，不依赖向量数据库、embedding、本地模型或独立搜索服务。

## 接下来准备建设

- 从更多页面直接带着当前事件、人物或目标询问 AI。
- 批量整理原始资料，生成事件、人物、记忆和关系 Proposal。
- 增加可取消、可重试、可从检查点继续的长任务运行机制。
- 根据真实使用反馈设计路径比较、假设、预测、计划修订和决定快照。
- 可选的每周整理：总结变化、检查计划与实际结果、提出下一步验证行动。
- 改善大规模人生星图的布局、筛选、时间播放和叙事浏览体验。

## 本地运行

需要 Node.js 22+、Corepack 和 Docker Desktop。

```bash
git clone https://github.com/laizhihui874-cmd/chronolabe.git
cd chronolabe
cp .env.example .env
corepack pnpm install
corepack pnpm db:up
corepack pnpm db:migrate:deploy
corepack pnpm build
```

启动开发服务：

```bash
corepack pnpm dev:api
corepack pnpm dev:web
```

默认入口：

- Web：`http://127.0.0.1:3212`
- API：`http://127.0.0.1:3211`
- 人生星图：`/life-graph`
- AI 助手：`/assistant`
- AI 设置：`/settings/ai`
- 统一待确认：`/ai-inbox`

### macOS 双击启动

```bash
corepack pnpm app:install
corepack pnpm app:start
corepack pnpm app:status
corepack pnpm app:stop
```

`app:install` 会生成未签名的本机 `.app`。当前版本仍依赖项目目录、Node.js 和 Docker Desktop。

## 技术结构

- Web：Next.js、React、Tailwind CSS
- API：NestJS、Prisma
- Database：PostgreSQL
- AI：OpenAI-compatible model adapter
- Graph：Three.js、React Three Fiber
- Monorepo：pnpm workspace

## 开发与测试

```bash
corepack pnpm verify:ci
```

数据库集成测试必须使用独立测试数据库：

```bash
TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/digital_self_verify?schema=public' \
TEST_DIRECT_URL='postgresql://postgres:postgres@localhost:5432/digital_self_verify?schema=public' \
VERIFY_SUITE=full \
corepack pnpm verify:all-local
```

测试运行器会拒绝把默认个人数据库当作测试库。

## 参与项目

Chronolabe 还处在需要大量验证和打磨的阶段。欢迎提交 Issue 或 Pull Request，尤其是这些方向：

- 本地优先软件与个人数据迁移；
- 人生事件、记忆和规划的数据模型；
- 3D 知识图谱交互与大图性能；
- 带来源的 AI 检索、回答与评测；
- macOS、Windows 和 Linux 的本机运行体验；
- 隐私、安全、备份与恢复。

如果你也认为人生记录不应该只停留在“写下来”，而应该能够被连接、理解、复盘并用于未来规划，欢迎一起建设。

## 项目状态

这是一个早期版本，不建议把它当作重要资料的唯一副本。导入个人档案或执行恢复前，请额外保留备份。医疗、心理、法律和投资问题应咨询相应专业人士，Chronolabe 不提供这些领域的专业结论。

## License

Licensed under the [Apache License 2.0](LICENSE).
