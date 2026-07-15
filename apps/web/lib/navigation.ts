export type NavigationItem = {
  href: string;
  label: string;
  description: string;
};

export const navItems: readonly NavigationItem[] = [
  { href: "/", label: "今日概览", description: "今天、档案与当前方向" },
  { href: "/life-graph", label: "人生星图", description: "事件、记忆与未来方向的 3D 关系图" },
  { href: "/assistant", label: "档案助手", description: "带原始引用的人生档案问答" },
  { href: "/ai-inbox", label: "统一待确认", description: "审核事件建议、候选记忆和能力证据" },
  { href: "/timeline", label: "人生时间线", description: "已确认事件与原始来源" },
  { href: "/archive", label: "待整理档案", description: "原始资料与候选事件" },
  { href: "/people", label: "人生人物", description: "重要人物与关系记录" },
  { href: "/planning", label: "未来指南针", description: "目标、计划、里程碑与行动" },
  { href: "/daily-entry/today", label: "每日记录", description: "原始记录与结构化日报" },
  { href: "/memories/review", label: "长期记忆", description: "候选确认与批量处理" },
  { href: "/ability-tree", label: "能力树", description: "能力节点与证据评分" },
  { href: "/weekly-review", label: "每周复盘", description: "推进、模式与下周建议" },
  { href: "/external-sources", label: "外部信息", description: "外部来源与决策证据" },
  { href: "/projects", label: "简历项目", description: "项目包装与投递素材" },
  { href: "/data-control", label: "数据与隐私", description: "本机处理、外部调用与档案导出" },
] as const;
