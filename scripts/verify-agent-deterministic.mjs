#!/usr/bin/env node

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const agentModule = await import(
  pathToFileURL("packages/agent/dist/index.js").href
);

const {
  DailyGuideAgent,
  SufficiencyCheckAgent,
  SimpleAgentOrchestrator,
  StaticModelAdapter,
} = agentModule;

const orchestrator = new SimpleAgentOrchestrator({
  modelAdapter: new StaticModelAdapter(),
});

orchestrator.register(DailyGuideAgent);
orchestrator.register(SufficiencyCheckAgent);

const context = {
  requestId: "verify-agent-deterministic",
  userId: "00000000-0000-4000-8000-000000000000",
};

const guideResult = await orchestrator.dispatch(
  {
    taskType: "daily-guide",
    input: {
      conversationId: "verify-conversation",
      currentMessage:
        "今天完成了会议预约 skill 的接口测试，但沟通有点不顺，压力很大。",
      currentLifeDecisionSummary: "继续工作、离职考研、换工作、边工作边准备",
    },
  },
  context,
);

assert.equal(guideResult.result.agentName, "DailyGuideAgent");
assert.ok(
  guideResult.result.output.followUpQuestion.includes("？"),
  "DailyGuideAgent should ask one follow-up question",
);
assert.ok(
  guideResult.result.output.informationGaps.length > 0,
  "DailyGuideAgent should report missing information gaps",
);
assert.ok(
  guideResult.result.output.provisionalSummary.includes("会议预约"),
  "DailyGuideAgent should retain a concise summary",
);
logPass("DailyGuideAgent deterministic follow-up works");

const sufficientResult = await orchestrator.dispatch(
  {
    taskType: "sufficiency-check",
    input: {
      conversationId: "verify-conversation",
      conversationTranscript:
        "今天做了接口测试，情绪有压力，困难是表达不清楚，收获是意识到要先列标准，明天继续整理项目，能力上练习沟通，决策影响是更倾向边工作边准备。",
      currentLifeDecisionSummary: "继续工作、离职考研、换工作、边工作边准备",
      requiredSections: [
        "facts",
        "emotions",
        "difficulties",
        "learnings",
        "next_actions",
        "growth_evidence",
        "decision_impact",
      ],
    },
  },
  context,
);

assert.equal(sufficientResult.result.agentName, "SufficiencyCheckAgent");
assert.equal(sufficientResult.result.output.sufficiencyStatus, "sufficient");
assert.equal(sufficientResult.result.output.shouldContinueAsking, false);
logPass("SufficiencyCheckAgent sufficient path works");

const insufficientResult = await orchestrator.dispatch(
  {
    taskType: "sufficiency-check",
    input: {
      conversationId: "verify-conversation",
      conversationTranscript: "今天很累。",
      currentLifeDecisionSummary: "继续工作、离职考研、换工作、边工作边准备",
      requiredSections: ["facts", "emotions", "next_actions", "decision_impact"],
    },
  },
  context,
);

assert.notEqual(
  insufficientResult.result.output.sufficiencyStatus,
  "sufficient",
  "short transcript should not be sufficient",
);
assert.equal(insufficientResult.result.output.shouldContinueAsking, true);
logPass("SufficiencyCheckAgent insufficient path works");

logPass("Deterministic agent verification completed");

function logPass(message) {
  console.log(`[verify:agent-deterministic] PASS ${message}`);
}
