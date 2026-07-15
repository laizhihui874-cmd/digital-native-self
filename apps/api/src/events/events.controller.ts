import type { EventCandidateDetail, EventDetail, EventParticipant, ListEventCandidatesResponse, ListEventsResponse, MemoryArchiveDetail } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, ValidationPipe } from "@nestjs/common";

import { CreateEventCandidateDto } from "./dto/create-event-candidate.dto";
import { CreateMemoryCandidateFromEventDto } from "./dto/create-memory-candidate-from-event.dto";
import { CreateEventParticipantDto } from "./dto/create-event-participant.dto";
import { ReviewEventCandidateDto } from "./dto/review-event-candidate.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateEventParticipantDto } from "./dto/update-event-participant.dto";
import { ListEventCandidatesQueryDto } from "./dto/list-event-candidates-query.dto";
import { ListEventsQueryDto } from "./dto/list-events-query.dto";
import { EventsService } from "./events.service";

const validationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller()
export class EventsController {
  constructor(@Inject(EventsService) private readonly service: EventsService) {}

  @Post("event-candidates")
  createCandidate(@Body(validationPipe) body: CreateEventCandidateDto): Promise<EventCandidateDetail> {
    return this.service.createCandidate(body);
  }

  @Get("event-candidates/:id")
  findCandidate(@Param("id", new ParseUUIDPipe()) id: string): Promise<EventCandidateDetail> {
    return this.service.findCandidate(id);
  }

  @Get("event-candidates")
  listCandidates(@Query(validationPipe) query: ListEventCandidatesQueryDto): Promise<ListEventCandidatesResponse> {
    return this.service.listCandidates(query);
  }

  @Patch("event-candidates/:id/review")
  reviewCandidate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: ReviewEventCandidateDto,
  ): Promise<EventCandidateDetail> {
    return this.service.reviewCandidate(id, body);
  }

  @Get("events/:id")
  findEvent(@Param("id", new ParseUUIDPipe()) id: string): Promise<EventDetail> {
    return this.service.findEvent(id);
  }

  @Get("events")
  listEvents(@Query(validationPipe) query: ListEventsQueryDto): Promise<ListEventsResponse> {
    return this.service.listEvents(query);
  }

  @Patch("events/:id")
  updateEvent(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: UpdateEventDto,
  ): Promise<EventDetail> {
    return this.service.updateEvent(id, body);
  }

  @Post("events/:id/memory-candidates")
  createMemoryCandidate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: CreateMemoryCandidateFromEventDto,
  ): Promise<MemoryArchiveDetail> {
    return this.service.createMemoryCandidate(id, body);
  }

  @Get("events/:id/participants")
  listParticipants(@Param("id", new ParseUUIDPipe()) id: string): Promise<EventParticipant[]> {
    return this.service.listParticipants(id);
  }

  @Post("events/:id/participants")
  createParticipant(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: CreateEventParticipantDto,
  ): Promise<EventParticipant> {
    return this.service.createParticipant(id, body);
  }

  @Patch("event-participants/:id")
  updateParticipant(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: UpdateEventParticipantDto,
  ): Promise<EventParticipant> {
    return this.service.updateParticipant(id, body);
  }

  @Delete("event-participants/:id")
  @HttpCode(204)
  deleteParticipant(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.deleteParticipant(id);
  }
}
