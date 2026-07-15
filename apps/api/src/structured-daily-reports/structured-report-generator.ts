import type {
  CreateMetricRatingRequest,
  CreateStructuredDailyReportRequest,
  MetricType,
  StructuredTextItem,
} from "@digital-self/shared";
import { metricScoreRange, metricTypeValues } from "@digital-self/shared";
import {
  OpenAICompatibleModelAdapter,
  StaticModelAdapter,
  type ModelAdapter,
  type ModelMessage,
} from "@digital-self/agent";

type GeneratedStructuredReportSections = Omit<CreateStructuredDailyReportRequest, "dailyEntryId">;

type GeneratedMetricAssessment = {
  score: number;
  reason: string;
};

type GeneratedStructuredReportModelOutput = {
  report: GeneratedStructuredReportSections;
  metrics: Record<MetricType, GeneratedMetricAssessment>;
};

type GeneratedStructuredReportResult = {
  structuredReport: CreateStructuredDailyReportRequest;
  metricRatings: Array<
    Pick<CreateMetricRatingRequest, "metricType" | "aiScore" | "aiReason" | "confirmedByUser">
  >;
  modelId: string;
};

const STRUCTURED_REPORT_SECTION_KEYS = [
  "facts",
  "emotions",
  "workItems",
  "feedback",
  "growthEvidence",
  "drainSources",
  "nextActions",
  "decisionImpact",
] satisfies Array<keyof GeneratedStructuredReportSections>;

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL_PROVIDER = "openai-compatible";
const FAKE_MODEL_PROVIDER = "fake";

export class StructuredReportGeneratorConfigurationError extends Error {}

export class StructuredReportGeneratorExecutionError extends Error {}

export class StructuredReportGeneratorOutputError extends Error {}

export async function generateStructuredDailyReportWithModel(params: {
  dailyEntryId: string;
  rawContent: string;
}): Promise<GeneratedStructuredReportResult> {
  const adapter = createStructuredReportModelAdapterFromEnvironment();
  const messages = buildStructuredReportModelMessages(params.rawContent);

  let responseText: string;
  let modelId: string;

  try {
    const response = await adapter.generate(messages, {
      temperature: 0.2,
      maxOutputTokens: 1_800,
    });
    responseText = response.text;
    modelId = response.modelId;
  } catch (error) {
    throw new StructuredReportGeneratorExecutionError(
      `Structured report generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const output = parseGeneratedStructuredReportOutput(responseText);

  return {
    structuredReport: {
      dailyEntryId: params.dailyEntryId,
      ...output.report,
    },
    metricRatings: metricTypeValues.map((metricType) => ({
      metricType,
      aiScore: output.metrics[metricType].score,
      aiReason: output.metrics[metricType].reason,
      confirmedByUser: false,
    })),
    modelId,
  };
}

function createStructuredReportModelAdapterFromEnvironment(): ModelAdapter {
  const provider = process.env.STRUCTURED_REPORT_GENERATOR_PROVIDER?.trim() || DEFAULT_OPENAI_MODEL_PROVIDER;

  if (provider === FAKE_MODEL_PROVIDER) {
    return new StaticModelAdapter({
      relay: {
        provider: "custom",
        modelId: "structured-report-fake",
        displayName: "Structured Report Fake Provider",
      },
      generateResult: (messages: ModelMessage[]) =>
        buildFakeStructuredReportResponse(extractRawContent(messages)),
    });
  }

  if (provider !== DEFAULT_OPENAI_MODEL_PROVIDER) {
    throw new StructuredReportGeneratorConfigurationError(
      `Unsupported STRUCTURED_REPORT_GENERATOR_PROVIDER "${provider}". Expected "${DEFAULT_OPENAI_MODEL_PROVIDER}" or "${FAKE_MODEL_PROVIDER}".`,
    );
  }

  const modelId = process.env.OPENAI_MODEL?.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!modelId || !apiKey) {
    throw new StructuredReportGeneratorConfigurationError(
      "Structured report generation requires OPENAI_MODEL and OPENAI_API_KEY. Configure both env vars or set STRUCTURED_REPORT_GENERATOR_PROVIDER=fake for deterministic local verification.",
    );
  }

  return new OpenAICompatibleModelAdapter({
    provider: "openai-compatible",
    modelId,
    displayName: "Structured Daily Report Generator",
    baseURL: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
    apiKeyEnvVar: "OPENAI_API_KEY",
  });
}

function buildStructuredReportModelMessages(rawContent: string): ModelMessage[] {
  const schema = `{
  "report": {
    "facts": [{ "title": "string (optional)", "detail": "string" }],
    "emotions": [{ "title": "string (optional)", "detail": "string" }],
    "workItems": [{ "title": "string (optional)", "detail": "string" }],
    "feedback": [{ "title": "string (optional)", "detail": "string" }],
    "growthEvidence": [{ "title": "string (optional)", "detail": "string" }],
    "drainSources": [{ "title": "string (optional)", "detail": "string" }],
    "nextActions": [{ "title": "string (optional)", "detail": "string" }],
    "decisionImpact": [{ "title": "string (optional)", "detail": "string" }]
  },
  "metrics": {
    "growth": { "score": 1, "reason": "string" },
    "emotional_drain": { "score": 1, "reason": "string" },
    "long_term_fit": { "score": 1, "reason": "string" },
    "communication_pressure": { "score": 1, "reason": "string" }
  }
}`;

  return [
    {
      role: "system",
      content:
        "You generate structured daily reports for an API. Reply with strict JSON only. Do not wrap the JSON in markdown fences. Do not include explanatory text before or after the JSON. Every metric reason must be non-empty and every metric score must be an integer between 1 and 5.",
    },
    {
      role: "user",
      content: [
        "Read the raw daily entry and convert it into the exact JSON shape below.",
        "Requirements:",
        "1. The top-level object must contain exactly two keys: report and metrics.",
        "2. report must include all eight arrays: facts, emotions, workItems, feedback, growthEvidence, drainSources, nextActions, decisionImpact.",
        "3. Each array item must be an object with detail:string and optional title:string.",
        "4. metrics must include growth, emotional_drain, long_term_fit, communication_pressure.",
        "5. Each metric must contain score:int(1..5) and reason:string.",
        "6. Keep the content grounded in the raw entry. Use concise Simplified Chinese unless the raw entry is clearly in another language.",
        "",
        "JSON schema example:",
        schema,
        "",
        "Raw daily entry:",
        rawContent,
      ].join("\n"),
    },
  ];
}

function parseGeneratedStructuredReportOutput(
  value: string,
): GeneratedStructuredReportModelOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value.trim());
  } catch (error) {
    throw new StructuredReportGeneratorOutputError(
      `Model output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new StructuredReportGeneratorOutputError("Model output root must be a JSON object.");
  }

  return {
    report: parseGeneratedStructuredReportSections(parsed.report),
    metrics: parseGeneratedMetricAssessments(parsed.metrics),
  };
}

function parseGeneratedStructuredReportSections(
  value: unknown,
): GeneratedStructuredReportSections {
  if (!isRecord(value)) {
    throw new StructuredReportGeneratorOutputError("Model output report must be a JSON object.");
  }

  return {
    facts: parseStructuredTextItems(value.facts, "report.facts"),
    emotions: parseStructuredTextItems(value.emotions, "report.emotions"),
    workItems: parseStructuredTextItems(value.workItems, "report.workItems"),
    feedback: parseStructuredTextItems(value.feedback, "report.feedback"),
    growthEvidence: parseStructuredTextItems(value.growthEvidence, "report.growthEvidence"),
    drainSources: parseStructuredTextItems(value.drainSources, "report.drainSources"),
    nextActions: parseStructuredTextItems(value.nextActions, "report.nextActions"),
    decisionImpact: parseStructuredTextItems(value.decisionImpact, "report.decisionImpact"),
  };
}

function parseStructuredTextItems(value: unknown, fieldName: string): StructuredTextItem[] {
  if (!Array.isArray(value)) {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must be an array.`);
  }

  return value.map((item, index) => parseStructuredTextItem(item, `${fieldName}[${index}]`));
}

function parseStructuredTextItem(value: unknown, fieldName: string): StructuredTextItem {
  if (!isRecord(value)) {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must be an object.`);
  }

  const detail = normalizeRequiredString(value.detail, `${fieldName}.detail`);
  const title = normalizeOptionalString(value.title, `${fieldName}.title`);

  return title ? { title, detail } : { detail };
}

function parseGeneratedMetricAssessments(
  value: unknown,
): Record<MetricType, GeneratedMetricAssessment> {
  if (!isRecord(value)) {
    throw new StructuredReportGeneratorOutputError("Model output metrics must be a JSON object.");
  }

  return {
    growth: parseMetricAssessment(value.growth, "metrics.growth"),
    emotional_drain: parseMetricAssessment(value.emotional_drain, "metrics.emotional_drain"),
    long_term_fit: parseMetricAssessment(value.long_term_fit, "metrics.long_term_fit"),
    communication_pressure: parseMetricAssessment(
      value.communication_pressure,
      "metrics.communication_pressure",
    ),
  };
}

function parseMetricAssessment(value: unknown, fieldName: string): GeneratedMetricAssessment {
  if (!isRecord(value)) {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must be an object.`);
  }

  const score = value.score;

  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < metricScoreRange.min ||
    score > metricScoreRange.max
  ) {
    throw new StructuredReportGeneratorOutputError(
      `${fieldName}.score must be an integer between ${metricScoreRange.min} and ${metricScoreRange.max}.`,
    );
  }

  return {
    score,
    reason: normalizeRequiredString(value.reason, `${fieldName}.reason`),
  };
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must not be empty.`);
  }

  return normalized;
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new StructuredReportGeneratorOutputError(`${fieldName} must be a string when provided.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function extractRawContent(messages: ModelMessage[]): string {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  return userMessage?.content ?? "";
}

function buildFakeStructuredReportResponse(rawContent: string): string {
  const normalizedContent = rawContent.trim();
  const lines = normalizedContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const fallbackLine = normalizedContent || "原始日报未提供有效内容。";

  const output: GeneratedStructuredReportModelOutput = {
    report: {
      facts: [
        {
          title: "关键事实",
          detail: lines[0] ?? fallbackLine,
        },
        {
          title: "补充事实",
          detail: lines[1] ?? fallbackLine,
        },
      ],
      emotions: [
        {
          title: "情绪信号",
          detail: findLine(lines, ["焦虑", "累", "压力", "开心", "疲惫"]) ?? "记录里体现出压力和情绪波动，需要继续观察。",
        },
      ],
      workItems: [
        {
          title: "推进事项",
          detail: lines[0] ?? fallbackLine,
        },
      ],
      feedback: [
        {
          title: "反馈",
          detail: findLine(lines, ["反馈", "评审", "建议", "沟通"]) ?? "当天有外部反馈或沟通输入，值得后续跟进。",
        },
      ],
      growthEvidence: [
        {
          title: "成长证据",
          detail: findLine(lines, ["学会", "改进", "优化", "复盘", "拆开"]) ?? "记录中体现出复盘和方法调整，说明有成长积累。",
        },
      ],
      drainSources: [
        {
          title: "消耗来源",
          detail: findLine(lines, ["焦虑", "累", "压力", "卡住", "反复"]) ?? "主要消耗来自任务复杂度和沟通成本。",
        },
      ],
      nextActions: [
        {
          title: "后续动作",
          detail: findLine(lines, ["接下来", "明天", "准备", "继续"]) ?? "下一步需要把当天遗留事项拆成可执行动作。",
        },
      ],
      decisionImpact: [
        {
          title: "决策影响",
          detail: findLine(lines, ["判断", "选择", "决定", "继续工作", "换工作", "考研"]) ?? "这条记录会影响对当前方向是否继续投入的判断。",
        },
      ],
    },
    metrics: {
      growth: {
        score: 4,
        reason: "记录中出现了交付、复盘和方法调整，成长信号较明确。",
      },
      emotional_drain: {
        score: 3,
        reason: "有压力和疲惫线索，但仍能维持推进，消耗处于中等水平。",
      },
      long_term_fit: {
        score: 3,
        reason: "内容同时包含推进感和去留判断，长期匹配度暂时不稳定。",
      },
      communication_pressure: {
        score: 4,
        reason: "出现了沟通、评审或反馈处理，说明当天存在较高的沟通压力。",
      },
    },
  };

  return JSON.stringify(output);
}

function findLine(lines: string[], keywords: string[]): string | undefined {
  return lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
