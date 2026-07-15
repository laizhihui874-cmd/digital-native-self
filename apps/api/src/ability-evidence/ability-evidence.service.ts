import type {
  AbilityEvidence,
  CreateAbilityEvidenceRequest,
  ListAbilityEvidenceResponse,
  ReviewAbilityEvidenceRequest,
} from "@digital-self/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AbilityNodesRepository } from "../ability-nodes/ability-nodes.repository";
import { DefaultIdentityService } from "../identity/default-identity.service";
import { AbilityEvidenceRepository } from "./ability-evidence.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const DEFAULT_STATUS = "candidate";
const DEFAULT_RECURRENCE_COUNT = 1;

@Injectable()
export class AbilityEvidenceService {
  constructor(
    @Inject(AbilityEvidenceRepository)
    private readonly abilityEvidenceRepository: AbilityEvidenceRepository,
    @Inject(AbilityNodesRepository)
    private readonly abilityNodesRepository: AbilityNodesRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateAbilityEvidenceRequest): Promise<AbilityEvidence> {
    const userId = await this.identityService.getCurrentUserId();
    await this.assertAbilityNodeExists(userId, input.abilityNodeId);

    return this.abilityEvidenceRepository.create(userId, {
      abilityNodeId: input.abilityNodeId,
      sourceCitationId: input.sourceCitationId,
      content: input.content,
      impact: input.impact,
      difficultyScore: input.difficultyScore,
      independenceScore: input.independenceScore,
      impactScore: input.impactScore,
      feedbackScore: input.feedbackScore,
      recurrenceCount: input.recurrenceCount ?? DEFAULT_RECURRENCE_COUNT,
      status: input.status ?? DEFAULT_STATUS,
    });
  }

  async list(query: {
    abilityNodeId?: CreateAbilityEvidenceRequest["abilityNodeId"];
    status?: AbilityEvidence["status"];
    limit?: number;
    offset?: number;
  }): Promise<ListAbilityEvidenceResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.abilityEvidenceRepository.list({
      userId,
      abilityNodeId: query.abilityNodeId,
      status: query.status,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async findById(id: string): Promise<AbilityEvidence> {
    const userId = await this.identityService.getCurrentUserId();
    const evidence = await this.abilityEvidenceRepository.findById(userId, id);

    if (!evidence) {
      throw new NotFoundException(`AbilityEvidence ${id} was not found.`);
    }

    return evidence;
  }

  async review(id: string, input: ReviewAbilityEvidenceRequest): Promise<AbilityEvidence> {
    const userId = await this.identityService.getCurrentUserId();
    const evidence = await this.abilityEvidenceRepository.review(userId, id, input);

    if (!evidence) {
      throw new NotFoundException(`AbilityEvidence ${id} was not found.`);
    }

    return evidence;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.abilityEvidenceRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`AbilityEvidence ${id} was not found.`);
    }
  }

  private async assertAbilityNodeExists(userId: string, abilityNodeId: string): Promise<void> {
    const abilityNode = await this.abilityNodesRepository.findFlatRecordById(userId, abilityNodeId);

    if (!abilityNode) {
      throw new NotFoundException(`AbilityNode ${abilityNodeId} was not found.`);
    }
  }
}
