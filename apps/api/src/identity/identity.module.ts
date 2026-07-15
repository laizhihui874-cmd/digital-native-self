import { Global, Module } from "@nestjs/common";

import { DefaultIdentityService } from "./default-identity.service";

@Global()
@Module({
  providers: [DefaultIdentityService],
  exports: [DefaultIdentityService],
})
export class IdentityModule {}
