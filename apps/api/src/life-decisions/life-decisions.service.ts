import type { DecisionPath, LifeDecision } from "@digital-self/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  LifeDecisionsRepository,
} from "./life-decisions.repository";
import type { LifeDecisionDetailResponse } from "./life-decision.mapper";

const DEFAULT_DECISION_STATUS = "active";

@Injectable()
export class LifeDecisionsService {
  constructor(
    @Inject(LifeDecisionsRepository)
    private readonly lifeDecisionsRepository: LifeDecisionsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: {
    title: string;
    description?: string;
    deadline?: string;
    status?: LifeDecision["status"];
    finalDecision?: string;
  }): Promise<LifeDecision> {
    const userId = await this.identityService.getCurrentUserId();

    return this.lifeDecisionsRepository.createDecision(userId, {
      ...input,
      status: input.status ?? DEFAULT_DECISION_STATUS,
    });
  }

  async list(query: { status?: LifeDecision["status"] }): Promise<LifeDecision[]> {
    const userId = await this.identityService.getCurrentUserId();
    return this.lifeDecisionsRepository.listDecisions(userId, query.status);
  }

  async findById(id: string): Promise<LifeDecisionDetailResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const decision = await this.lifeDecisionsRepository.findDecisionById(userId, id);

    if (!decision) {
      throw new NotFoundException(`LifeDecision ${id} was not found.`);
    }

    return decision;
  }

  async updateDecision(
    id: string,
    input: {
      title?: string;
      description?: string | null;
      deadline?: string | null;
      status?: LifeDecision["status"];
      finalDecision?: string | null;
    },
  ): Promise<LifeDecision> {
    const userId = await this.identityService.getCurrentUserId();
    const decision = await this.lifeDecisionsRepository.updateDecision(userId, id, input);

    if (!decision) {
      throw new NotFoundException(`LifeDecision ${id} was not found.`);
    }

    return decision;
  }

  async createPath(
    decisionId: string,
    input: {
      title: string;
      description?: string;
      benefits?: string[];
      risks?: string[];
      currentScore?: number;
    },
  ): Promise<DecisionPath> {
    const userId = await this.identityService.getCurrentUserId();
    await this.assertDecisionExists(userId, decisionId);

    return this.lifeDecisionsRepository.createPath(decisionId, {
      ...input,
      benefits: input.benefits ?? [],
      risks: input.risks ?? [],
    });
  }

  async updatePath(
    decisionId: string,
    pathId: string,
    input: {
      title?: string;
      description?: string | null;
      benefits?: string[];
      risks?: string[];
      currentScore?: number | null;
    },
  ): Promise<DecisionPath> {
    const userId = await this.identityService.getCurrentUserId();
    await this.assertDecisionExists(userId, decisionId);

    const path = await this.lifeDecisionsRepository.updatePath(userId, decisionId, pathId, input);

    if (!path) {
      throw new NotFoundException(`DecisionPath ${pathId} was not found.`);
    }

    return path;
  }

  private async assertDecisionExists(userId: string, decisionId: string): Promise<void> {
    const existingId = await this.lifeDecisionsRepository.findOwnedDecisionId(userId, decisionId);

    if (!existingId) {
      throw new NotFoundException(`LifeDecision ${decisionId} was not found.`);
    }
  }
}
