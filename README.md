# Digital Native Self

Digital Native Self（数字原生自我）是一款本地优先的人生档案与规划软件。它把每日记录、事件、人物、记忆、项目、能力证据和未来计划连接成可以追溯来源的个人档案，并提供 3D 人生星图和带引用的 AI 档案问答。

## 当前能力

- 原始资料、事件、人物、长期记忆、项目与能力档案
- 目标、计划、里程碑和行动管理
- 3D 人生星图、人工关系和历史时间查看
- 本机关键词档案搜索，不依赖向量数据库
- OpenAI 兼容模型的带引用问答
- Proposal、候选记忆和能力证据的统一审核
- ZIP 档案导出、恢复预检、合并恢复和整库替换
- macOS 双击启动器

AI 默认关闭。只有用户明确保存模型服务、API 密钥并同意发送必要资料后，软件才会调用外部模型。API 密钥保存在 macOS 钥匙串，不写入个人数据库或导出包。

## 技术结构

- Web：Next.js、React、Tailwind CSS
- API：NestJS、Prisma
- Database：PostgreSQL
- Agent：OpenAI-compatible model adapter
- Graph：Three.js / React Three Fiber
- Monorepo：pnpm workspace

## 本地运行

需要 Node.js 22+、Corepack 和 Docker Desktop。

```bash
cp .env.example .env
corepack pnpm install
corepack pnpm db:up
corepack pnpm db:migrate:deploy
corepack pnpm build
```

开发模式：

```bash
corepack pnpm dev:api
corepack pnpm dev:web
```

macOS 本机启动器：

```bash
corepack pnpm app:install
corepack pnpm app:start
corepack pnpm app:status
corepack pnpm app:stop
```

`app:install` 会生成并安装未签名的本机 `.app`。第一版仍依赖当前项目目录、Node.js 和 Docker Desktop。

## AI 设置

打开 `/settings/ai`，配置一个 OpenAI 兼容服务、快速模型和分析模型。密钥不要写入 `.env.example`、源码或提交记录。

档案问答只发送：

- 当前问题
- 最近 6 条对话消息
- 最多 8 条相关档案片段

问答模型没有系统工具，也不能直接写入正式档案。

## 测试

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

## 数据与隐私

- `.env`、`storage/`、数据库备份、运行日志和本机评测数据不会进入 Git。
- 软件默认只绑定 loopback 地址。
- 导入文件在本机解析。
- AI 权限可以随时撤销，撤销时同步删除钥匙串密钥。
- 整库替换恢复前会创建备份，并要求明确确认。

这是早期版本。请在导入重要资料或执行恢复前自行保留额外备份。

## License

Licensed under the [Apache License 2.0](LICENSE).
