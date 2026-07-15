import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";

@Module({ imports: [IdentityModule], controllers: [PeopleController], providers: [PeopleService] })
export class PeopleModule {}
