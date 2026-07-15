import type {
  CreateProjectRequest,
  ListProjectsQuery,
  ListProjectsResponse,
  Project,
  ProjectDetail,
  UpdateProjectRequest,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { ProjectsRepository } from "./projects.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly projectsRepository: ProjectsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateProjectRequest): Promise<Project> {
    const userId = await this.identityService.getCurrentUserId();
    this.assertDateRange(input.startDate, input.endDate);
    await this.assertAbilityEvidenceIds(userId, input.abilityEvidenceIds ?? []);

    return this.projectsRepository.create(userId, normalizeProjectInput(input));
  }

  async list(query: ListProjectsQuery): Promise<ListProjectsResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.projectsRepository.list({
      userId,
      status: query.status,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async findById(id: string): Promise<ProjectDetail> {
    const userId = await this.identityService.getCurrentUserId();
    const project = await this.projectsRepository.findById(userId, id);

    if (!project) {
      throw new NotFoundException(`Project ${id} was not found.`);
    }

    return project;
  }

  async update(id: string, input: UpdateProjectRequest): Promise<Project> {
    const userId = await this.identityService.getCurrentUserId();
    this.assertDateRange(input.startDate, input.endDate);

    if (input.abilityEvidenceIds !== undefined) {
      await this.assertAbilityEvidenceIds(userId, input.abilityEvidenceIds);
    }

    const project = await this.projectsRepository.update(userId, id, normalizeProjectInput(input));

    if (!project) {
      throw new NotFoundException(`Project ${id} was not found.`);
    }

    return project;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.projectsRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`Project ${id} was not found.`);
    }
  }

  private assertDateRange(startDate?: string, endDate?: string): void {
    if (!startDate || !endDate) {
      return;
    }

    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      throw new BadRequestException("Project startDate must be before or equal to endDate.");
    }
  }

  private async assertAbilityEvidenceIds(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const ownedIds = await this.projectsRepository.findOwnedAbilityEvidenceIds(userId, ids);
    const missingIds = ids.filter((id) => !ownedIds.includes(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(`AbilityEvidence ${missingIds[0]} was not found.`);
    }
  }
}

function normalizeProjectInput<T extends CreateProjectRequest | UpdateProjectRequest>(input: T): T {
  return {
    ...input,
    outcomes: input.outcomes?.map((item) => item.trim()).filter(Boolean),
  };
}
