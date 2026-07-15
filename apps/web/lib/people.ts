import type { CreatePersonRequest, Person } from "@digital-self/shared";
import { apiRequest } from "@/lib/api-client";
export function listPeople() { return apiRequest<Person[]>("/api/people"); }
export function createPerson(input: CreatePersonRequest) { return apiRequest<Person>("/api/people", { method: "POST", body: JSON.stringify(input) }); }
export function deletePerson(id: string) { return apiRequest<void>(`/api/people/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined }); }
