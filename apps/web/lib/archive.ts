import type {
  CreateEventCandidateRequest,
  CreateTextEvidenceArtifactRequest,
  EventCandidateDetail,
  EventDetail,
  EvidenceArtifactDetail,
  ListEventCandidatesResponse,
  ListEventsResponse,
  ListEvidenceArtifactsResponse,
  ReviewEventCandidateRequest,
  CreateMemoryCandidateFromEventRequest,
  CreateEventParticipantRequest,
  EventParticipant,
  MemoryArchiveDetail,
} from "@digital-self/shared";

import { apiRequest } from "@/lib/api-client";

export function createTextEvidence(input: CreateTextEvidenceArtifactRequest) {
  return apiRequest<EvidenceArtifactDetail>("/api/evidence/artifacts/text", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uploadEvidenceFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<EvidenceArtifactDetail>("/api/evidence/artifacts/file", {
    method: "POST",
    body,
  });
}

export function listEvidenceArtifacts(limit = 30) {
  return apiRequest<ListEvidenceArtifactsResponse>(`/api/evidence/artifacts?limit=${limit}&offset=0`);
}

export function getEvidenceArtifact(id: string) {
  return apiRequest<EvidenceArtifactDetail>(`/api/evidence/artifacts/${id}`);
}

export function createEventCandidate(input: CreateEventCandidateRequest) {
  return apiRequest<EventCandidateDetail>("/api/event-candidates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listEventCandidates(status: "candidate" | "confirmed" | "rejected" = "candidate") {
  return apiRequest<ListEventCandidatesResponse>(`/api/event-candidates?status=${status}&limit=50&offset=0`);
}

export function reviewEventCandidate(id: string, input: ReviewEventCandidateRequest) {
  return apiRequest<EventCandidateDetail>(`/api/event-candidates/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listEvents(limit = 100) {
  return apiRequest<ListEventsResponse>(`/api/events?limit=${limit}&offset=0`);
}

export function getEvent(id: string) {
  return apiRequest<EventDetail>(`/api/events/${id}`);
}

export function createMemoryCandidateFromEvent(
  eventId: string,
  input: CreateMemoryCandidateFromEventRequest,
) {
  return apiRequest<MemoryArchiveDetail>(`/api/events/${eventId}/memory-candidates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createEventParticipant(eventId: string, input: CreateEventParticipantRequest) {
  return apiRequest<EventParticipant>(`/api/events/${eventId}/participants`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteEventParticipant(id: string) {
  return apiRequest<void>(
    `/api/event-participants/${id}`,
    { method: "DELETE" },
    { allowEmpty: true, emptyData: undefined },
  );
}
