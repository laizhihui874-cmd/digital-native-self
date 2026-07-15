import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { GraphRelationsController } from "./graph-relations.controller";
import { GraphRelationsService } from "./graph-relations.service";

@Module({ imports: [IdentityModule], controllers: [GraphRelationsController], providers: [GraphRelationsService] })
export class GraphRelationsModule {}
