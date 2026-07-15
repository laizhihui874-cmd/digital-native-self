import type {
  AiAssistantStreamEvent,
  AiConversation,
  AiMessageWithCitations,
  AiSettings,
  CreateAiMessageRequest,
  TestAiSettingsResponse,
  UpdateAiSettingsRequest,
} from "@digital-self/shared";

import { ApiClientError, apiRequest, getApiBaseUrl } from "./api-client";

export function getAiSettings() { return apiRequest<AiSettings>("/api/ai/settings"); }
export function updateAiSettings(input: UpdateAiSettingsRequest) { return apiRequest<AiSettings>("/api/ai/settings", { method: "PUT", body: JSON.stringify(input) }); }
export function testAiSettings(slot: "fast" | "analysis" = "fast") { return apiRequest<TestAiSettingsResponse>("/api/ai/settings/test", { method: "POST", body: JSON.stringify({ slot }) }); }
export function listAiConversations() { return apiRequest<AiConversation[]>("/api/ai/conversations"); }
export function createAiConversation(title?: string) { return apiRequest<AiConversation>("/api/ai/conversations", { method: "POST", body: JSON.stringify({ title }) }); }
export function renameAiConversation(id: string, title: string) { return apiRequest<AiConversation>(`/api/ai/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }); }
export function deleteAiConversation(id: string) { return apiRequest<void>(`/api/ai/conversations/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined }); }
export function getAiMessages(id: string) { return apiRequest<AiMessageWithCitations[]>(`/api/ai/conversations/${id}/messages`); }

export async function streamAiMessage(
  conversationId: string,
  input: CreateAiMessageRequest,
  onEvent: (event: AiAssistantStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    let message = "无法开始回答。";
    try {
      const payload = await response.json() as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {}
    throw new ApiClientError(message, { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (!data) continue;
      const event = JSON.parse(data) as AiAssistantStreamEvent;
      onEvent(event);
      if (event.type === "error") throw new ApiClientError(event.message);
    }
    if (done) break;
  }
}
