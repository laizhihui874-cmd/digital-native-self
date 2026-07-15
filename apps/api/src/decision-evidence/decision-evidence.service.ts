import type {
  CreateDecisionEvidenceRequest,
  DecisionEvidence,
  ListDecisionEvidenceQuery,
  ListDecisionEvidenceResponse,
  UpdateDecisionEvidenceRequest,
} from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { DecisionEvidenceRepository } from "./decision-evidence.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

@Injectable()
export class DecisionEvidenceService {
  constructor(
    @Inject(DecisionEvidenceRepository)
    private readonly decisionEvidenceRepository: DecisionEvidenceRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateDecisionEvidenceRequest): Promise<DecisionEvidence> {
    const userId = await this.identityService.getCurrentUserId();

    await this.assertDecisionExists(userId, input.decisionId);
    await this.assertPathExists(userId, input.decisionId, input.pathId);

    const sourceCitationId = await this.resolveSourceCitationId(userId, input);

    return this.decisionEvidenceRepository.create({
      decisionId: input.decisionId,
      pathId: input.pathId,
      evidenceType: input.evidenceType,
      content: input.content,
      sourceCitationId,
      weight: input.weight,
    });
  }

  async list(query: ListDecisionEvidenceQuery): Promise<DecisionEvidence[] | ListDecisionEvidenceResponse> {
    const userId = await this.identityService.getCurrentUserId();

    if (query.decisionId) {
      await this.assertDecisionExists(userId, query.decisionId);
    }

    if (query.pathId) {
      if (query.decisionId) {
        await this.assertPathExists(userId, query.decisionId, query.pathId);
      } else {
        await this.assertPathExistsForUser(userId, query.pathId);
      }
    }

    if (query.limit !== undefined || query.offset !== undefined) {
      return this.decisionEvidenceRepository.listPaginated(userId, query, {
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      });
    }

    return this.decisionEvidenceRepository.list(userId, query);
  }

  async findById(id: string): Promise<DecisionEvidence> {
    const userId = await this.identityService.getCurrentUserId();
    const evidence = await this.decisionEvidenceRepository.findById(userId, id);

    if (!evidence) {
      throw new NotFoundException(`DecisionEvidence ${id} was not found.`);
    }

    return evidence;
  }

  async update(id: string, input: UpdateDecisionEvidenceRequest): Promise<DecisionEvidence> {
    const userId = await this.identityService.getCurrentUserId();
    const evidence = await this.decisionEvidenceRepository.update(userId, id, input);

    if (!evidence) {
      throw new NotFoundException(`DecisionEvidence ${id} was not found.`);
    }

    return evidence;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.decisionEvidenceRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`DecisionEvidence ${id} was not found.`);
    }
  }

  private async assertDecisionExists(userId: string, decisionId: string): Promise<void> {
    const existingId = await this.decisionEvidenceRepository.findOwnedDecisionId(userId, decisionId);

    if (!existingId) {
      throw new NotFoundException(`LifeDecision ${decisionId} was not found.`);
    }
  }

  private async assertPathExists(userId: string, decisionId: string, pathId: string): Promise<void> {
    const existingId = await this.decisionEvidenceRepository.findOwnedPathId(userId, decisionId, pathId);

    if (!existingId) {
      throw new NotFoundException(`DecisionPath ${pathId} was not found.`);
    }
  }

  private async assertPathExistsForUser(userId: string, pathId: string): Promise<void> {
    const existingId = await this.decisionEvidenceRepository.findOwnedPathIdByUser(userId, pathId);

    if (!existingId) {
      throw new NotFoundException(`DecisionPath ${pathId} was not found.`);
    }
  }

  private async resolveSourceCitationId(
    userId: string,
    input: CreateDecisionEvidenceRequest,
  ): Promise<string | undefined> {
    const sourceCitationId = input.sourceCitationId;
    const externalSourceId = input.externalSourceId;

    if (sourceCitationId) {
      const existingCitation = await this.decisionEvidenceRepository.findOwnedSourceCitationById(
        userId,
        sourceCitationId,
      );

      if (!existingCitation) {
        throw new NotFoundException(`SourceCitation ${sourceCitationId} was not found.`);
      }

      if (externalSourceId && existingCitation.sourceType === "external_link") {
        if (existingCitation.sourceId !== externalSourceId) {
          throw new BadRequestException(
            "sourceCitationId does not belong to the provided externalSourceId.",
          );
        }
      }

      return existingCitation.id;
    }

    if (!externalSourceId) {
      return undefined;
    }

    const externalSource = await this.decisionEvidenceRepository.findOwnedExternalSourceById(
      userId,
      externalSourceId,
    );

    if (!externalSource) {
      throw new NotFoundException(`ExternalSource ${externalSourceId} was not found.`);
    }

    if (
      externalSource.lifeDecisionId !== null &&
      externalSource.lifeDecisionId !== input.decisionId
    ) {
      throw new BadRequestException(
        "externalSourceId must belong to the same LifeDecision when it is already attached.",
      );
    }

    const existingCitation = await this.decisionEvidenceRepository.findSourceCitationBySource(
      "external_link",
      externalSource.id,
    );

    if (existingCitation) {
      return existingCitation.id;
    }

    const createdCitation = await this.decisionEvidenceRepository.createSourceCitation({
      sourceType: "external_link",
      sourceId: externalSource.id,
      title: externalSource.title,
      url: externalSource.url,
      excerpt: buildExternalSourceCitationExcerpt(externalSource.summary, externalSource.relationToDecision),
      locator: `external-source:${externalSource.id}`,
      metadata: {
        sourceSite: externalSource.sourceSite,
        publishedAt: externalSource.publishedAt?.toISOString() ?? null,
        fetchedAt: externalSource.fetchedAt?.toISOString() ?? null,
        lifeDecisionId: externalSource.lifeDecisionId,
      },
    });

    return createdCitation.id;
  }
}

function buildExternalSourceCitationExcerpt(
  summary?: string | null,
  relationToDecision?: string | null,
): string | undefined {
  const parts = [summary?.trim(), relationToDecision?.trim()].filter(
    (value): value is string => Boolean(value),
  );

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n\n");
}
