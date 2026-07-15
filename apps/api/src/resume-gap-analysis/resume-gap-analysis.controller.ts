import type {
  CreateResumeGapAnalysisRequest,
  ResumeGapAnalysisResponse,
} from "@digital-self/shared";
import { Body, Controller, Inject, Post, ValidationPipe } from "@nestjs/common";

import { CreateResumeGapAnalysisDto } from "./dto/create-resume-gap-analysis.dto";
import { ResumeGapAnalysisService } from "./resume-gap-analysis.service";

const createResumeGapAnalysisValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateResumeGapAnalysisDto,
});

@Controller("resume-gap-analysis")
export class ResumeGapAnalysisController {
  constructor(
    @Inject(ResumeGapAnalysisService)
    private readonly resumeGapAnalysisService: ResumeGapAnalysisService,
  ) {}

  @Post()
  create(
    @Body(createResumeGapAnalysisValidationPipe) body: CreateResumeGapAnalysisRequest,
  ): Promise<ResumeGapAnalysisResponse> {
    return this.resumeGapAnalysisService.create(body);
  }
}
