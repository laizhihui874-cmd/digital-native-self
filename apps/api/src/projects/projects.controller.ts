import type {
  ListProjectsResponse,
  Project,
  ProjectDetail,
} from "@digital-self/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

const createProjectValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateProjectDto,
});

const listProjectsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListProjectsQueryDto,
});

const updateProjectValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateProjectDto,
});

@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  create(@Body(createProjectValidationPipe) body: CreateProjectDto): Promise<Project> {
    return this.projectsService.create(body);
  }

  @Get()
  list(@Query(listProjectsValidationPipe) query: ListProjectsQueryDto): Promise<ListProjectsResponse> {
    return this.projectsService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<ProjectDetail> {
    return this.projectsService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateProjectValidationPipe) body: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.projectsService.delete(id);
  }
}
