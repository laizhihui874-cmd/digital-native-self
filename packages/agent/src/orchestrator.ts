import type { ModelAdapter } from "./model-adapter";

export type AgentName =
  | "MainOrchestrator"
  | "DailyGuideAgent"
  | "SufficiencyCheckAgent"
  | "EmotionFactSplitAgent"
  | "MemoryExtractionAgent"
  | "DecisionAnalysisAgent"
  | "WeeklyReviewAgent"
  | "CareerResearchAgent"
  | "ResumePackagingAgent";

export interface OrchestratorExecutionContext {
  requestId: string;
  userId: string;
  sessionId?: string;
  currentDecisionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export type OrchestratorTaskType = OrchestratorTask<unknown>["taskType"];

export interface OrchestratorToolCall {
  toolName: string;
  input: Record<string, unknown>;
  reason?: string;
}

export interface OrchestratorToolResult {
  toolName: string;
  success: boolean;
  output?: unknown;
  errorMessage?: string;
  latencyMs?: number;
}

export type OrchestratorToolCaller = (
  toolCall: OrchestratorToolCall,
) => Promise<OrchestratorToolResult>;

export type OrchestratorLogger = (
  eventName: string,
  payload: Record<string, unknown>,
) => Promise<void> | void;

export interface AgentExecutionResult<TOutput> {
  agentName: AgentName;
  output: TOutput;
  toolCalls?: OrchestratorToolResult[];
  modelId?: string;
  latencyMs?: number;
}

export interface AgentDefinition<TInput, TOutput> {
  name: AgentName;
  description: string;
  run(
    input: TInput,
    runtime: AgentRuntime,
  ): Promise<AgentExecutionResult<TOutput>>;
}

export interface AgentRuntime {
  modelAdapter: ModelAdapter;
  context: OrchestratorExecutionContext;
  callTool?: OrchestratorToolCaller;
  emitLog?: OrchestratorLogger;
}

export interface OrchestratorTask<TInput> {
  taskType:
    | "daily-guide"
    | "sufficiency-check"
    | "emotion-fact-split"
    | "memory-extraction"
    | "decision-analysis"
    | "weekly-review"
    | "career-research"
    | "resume-packaging";
  input: TInput;
}

export interface OrchestratorDispatchResult<TOutput> {
  taskType: OrchestratorTask<unknown>["taskType"];
  result: AgentExecutionResult<TOutput>;
}

export interface AgentOrchestrator {
  dispatch<TInput, TOutput>(
    task: OrchestratorTask<TInput>,
    context: OrchestratorExecutionContext,
  ): Promise<OrchestratorDispatchResult<TOutput>>;

  register<TInput, TOutput>(agent: AgentDefinition<TInput, TOutput>): void;
}

export const TASK_TYPE_TO_AGENT_NAME: Record<OrchestratorTaskType, AgentName> = {
  "daily-guide": "DailyGuideAgent",
  "sufficiency-check": "SufficiencyCheckAgent",
  "emotion-fact-split": "EmotionFactSplitAgent",
  "memory-extraction": "MemoryExtractionAgent",
  "decision-analysis": "DecisionAnalysisAgent",
  "weekly-review": "WeeklyReviewAgent",
  "career-research": "CareerResearchAgent",
  "resume-packaging": "ResumePackagingAgent",
};

export interface SimpleAgentOrchestratorOptions {
  modelAdapter: ModelAdapter;
  callTool?: OrchestratorToolCaller;
  emitLog?: OrchestratorLogger;
}

export class SimpleAgentOrchestrator implements AgentOrchestrator {
  private readonly modelAdapter: ModelAdapter;
  private readonly callTool?: OrchestratorToolCaller;
  private readonly emitLog?: OrchestratorLogger;
  private readonly agents = new Map<AgentName, AgentDefinition<unknown, unknown>>();

  constructor(options: SimpleAgentOrchestratorOptions) {
    this.modelAdapter = options.modelAdapter;
    this.callTool = options.callTool;
    this.emitLog = options.emitLog;
  }

  register<TInput, TOutput>(agent: AgentDefinition<TInput, TOutput>): void {
    this.agents.set(
      agent.name,
      agent as AgentDefinition<unknown, unknown>,
    );
  }

  async dispatch<TInput, TOutput>(
    task: OrchestratorTask<TInput>,
    context: OrchestratorExecutionContext,
  ): Promise<OrchestratorDispatchResult<TOutput>> {
    const agentName = getAgentNameForTaskType(task.taskType);
    const agent = this.agents.get(agentName);

    if (!agent) {
      throw new Error(
        `No agent registered for task type "${task.taskType}". Expected registered agent "${agentName}".`,
      );
    }

    await this.emitLog?.("orchestrator.dispatch.started", {
      taskType: task.taskType,
      agentName,
      requestId: context.requestId,
      userId: context.userId,
      traceId: context.traceId,
    });

    const runtime: AgentRuntime = {
      modelAdapter: this.modelAdapter,
      context,
      callTool: this.callTool,
      emitLog: this.emitLog,
    };

    try {
      const result = (await agent.run(
        task.input,
        runtime,
      )) as AgentExecutionResult<TOutput>;

      if (result.agentName !== agentName) {
        throw new Error(
          `Agent "${agentName}" returned mismatched agentName "${result.agentName}".`,
        );
      }

      await this.emitLog?.("orchestrator.dispatch.completed", {
        taskType: task.taskType,
        agentName,
        requestId: context.requestId,
        userId: context.userId,
        latencyMs: result.latencyMs,
      });

      return {
        taskType: task.taskType,
        result,
      };
    } catch (error) {
      await this.emitLog?.("orchestrator.dispatch.failed", {
        taskType: task.taskType,
        agentName,
        requestId: context.requestId,
        userId: context.userId,
        errorMessage:
          error instanceof Error ? error.message : "Unknown orchestrator error",
      });

      throw error;
    }
  }
}

export function getAgentNameForTaskType(taskType: OrchestratorTaskType): AgentName {
  return TASK_TYPE_TO_AGENT_NAME[taskType];
}
