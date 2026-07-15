import type { AiConversation, AiMessageWithCitations, ListAiConversationsResponse } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Res, ValidationPipe } from "@nestjs/common";
import type { Response } from "express";

import { AiConversationsService } from "./ai-conversations.service";
import { CreateAiConversationDto, CreateAiMessageDto, UpdateAiConversationDto } from "./dto/ai-conversation.dto";
import { normalizeAiProviderError } from "../ai-core/ai-model.gateway";

const createConversationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: CreateAiConversationDto });
const updateConversationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: UpdateAiConversationDto });
const createMessagePipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: CreateAiMessageDto });

@Controller("ai/conversations")
export class AiConversationsController {
  constructor(@Inject(AiConversationsService) private readonly conversations: AiConversationsService) {}

  @Get()
  list(): Promise<ListAiConversationsResponse> { return this.conversations.list(); }

  @Post()
  create(@Body(createConversationPipe) body: CreateAiConversationDto): Promise<AiConversation> { return this.conversations.create(body); }

  @Patch(":id")
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body(updateConversationPipe) body: UpdateAiConversationDto): Promise<AiConversation> { return this.conversations.update(id, body); }

  @Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.conversations.delete(id); }

  @Get(":id/messages")
  messages(@Param("id", new ParseUUIDPipe()) id: string): Promise<AiMessageWithCitations[]> { return this.conversations.messages(id); }

  @Post(":id/messages")
  async send(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(createMessagePipe) body: CreateAiMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    response.status(HttpStatus.OK);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    try {
      for await (const event of this.conversations.sendMessage(id, body)) response.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      const normalized = normalizeAiProviderError(error, "stream");
      response.write(`data: ${JSON.stringify({ type: "error", message: normalized.safeMessage, code: normalized.code })}\n\n`);
    } finally {
      response.end();
    }
  }
}
