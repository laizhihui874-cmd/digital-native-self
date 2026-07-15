import { Controller, Get } from "@nestjs/common";

import { coreResourceRegistry } from "./core-resource-registry";

@Controller("resources")
export class ResourcesController {
  @Get()
  getResources() {
    return coreResourceRegistry;
  }
}
