import type {
  ActionItem,
  CreateActionItemRequest,
  CreateFuturePlanRequest,
  CreateGoalRequest,
  CreateMilestoneRequest,
  FuturePlan,
  Goal,
  Milestone,
  PlanningTree,
  UpdateActionItemRequest,
  UpdateFuturePlanRequest,
  UpdateGoalRequest,
  UpdateMilestoneRequest,
} from "@digital-self/shared";
import { apiRequest } from "@/lib/api-client";

export const getPlanningTree = () => apiRequest<PlanningTree>("/api/planning/tree");
export const createGoal = (input: CreateGoalRequest) => apiRequest<Goal>("/api/planning/goals", { method: "POST", body: JSON.stringify(input) });
export const updateGoal = (id: string, input: UpdateGoalRequest) => apiRequest<Goal>(`/api/planning/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteGoal = (id: string) => apiRequest<void>(`/api/planning/goals/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined });
export const createFuturePlan = (goalId: string, input: CreateFuturePlanRequest) => apiRequest<FuturePlan>(`/api/planning/goals/${goalId}/plans`, { method: "POST", body: JSON.stringify(input) });
export const updateFuturePlan = (id: string, input: UpdateFuturePlanRequest) => apiRequest<FuturePlan>(`/api/planning/plans/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteFuturePlan = (id: string) => apiRequest<void>(`/api/planning/plans/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined });
export const createMilestone = (planId: string, input: CreateMilestoneRequest) => apiRequest<Milestone>(`/api/planning/plans/${planId}/milestones`, { method: "POST", body: JSON.stringify(input) });
export const updateMilestone = (id: string, input: UpdateMilestoneRequest) => apiRequest<Milestone>(`/api/planning/milestones/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteMilestone = (id: string) => apiRequest<void>(`/api/planning/milestones/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined });
export const createActionItem = (planId: string, input: CreateActionItemRequest) => apiRequest<ActionItem>(`/api/planning/plans/${planId}/actions`, { method: "POST", body: JSON.stringify(input) });
export const updateActionItem = (id: string, input: UpdateActionItemRequest) => apiRequest<ActionItem>(`/api/planning/actions/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteActionItem = (id: string) => apiRequest<void>(`/api/planning/actions/${id}`, { method: "DELETE" }, { allowEmpty: true, emptyData: undefined });
