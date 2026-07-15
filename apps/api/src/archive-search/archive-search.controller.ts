import type { ArchiveSearchResponse } from "@digital-self/shared";
import { Body, Controller, Inject, Post, ValidationPipe } from "@nestjs/common";

import { ArchiveSearchService } from "./archive-search.service";
import { ArchiveSearchDto } from "./dto/archive-search.dto";

const searchPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: ArchiveSearchDto });

@Controller("archive-search")
export class ArchiveSearchController {
  constructor(@Inject(ArchiveSearchService) private readonly searchService: ArchiveSearchService) {}
  @Post()
  search(@Body(searchPipe) body: ArchiveSearchDto): Promise<ArchiveSearchResponse> { return this.searchService.search(body); }
}
