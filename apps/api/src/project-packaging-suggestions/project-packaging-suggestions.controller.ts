import type {
  CreateProjectPackagingSuggestionsRequest,
  ProjectPackagingSuggestionsResponse,
} from "@digital-self/shared";
import { Body, Controller, Inject, Post, ValidationPipe } from "@nestjs/common";

import { CreateProjectPackagingSuggestionsDto } from "./dto/create-project-packaging-suggestions.dto";
import { ProjectPackagingSuggestionsService } from "./project-packaging-suggestions.service";

const createProjectPackagingSuggestionsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateProjectPackagingSuggestionsDto,
});

@Controller("project-packaging-suggestions")
export class ProjectPackagingSuggestionsController {
  constructor(
    @Inject(ProjectPackagingSuggestionsService)
    private readonly projectPackagingSuggestionsService: ProjectPackagingSuggestionsService,
  ) {}

  @Post()
  create(
    @Body(createProjectPackagingSuggestionsValidationPipe)
    body: CreateProjectPackagingSuggestionsRequest,
  ): Promise<ProjectPackagingSuggestionsResponse> {
    return this.projectPackagingSuggestionsService.create(body);
  }
}
