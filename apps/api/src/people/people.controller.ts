import type { Person } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, ValidationPipe } from "@nestjs/common";
import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { PeopleService } from "./people.service";
const validationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller("people")
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly service: PeopleService) {}
  @Get() list(): Promise<Person[]> { return this.service.list(); }
  @Post() create(@Body(validationPipe) body: CreatePersonDto): Promise<Person> { return this.service.create(body); }
  @Patch(":id") update(@Param("id", new ParseUUIDPipe()) id: string, @Body(validationPipe) body: UpdatePersonDto): Promise<Person> { return this.service.update(id, body); }
  @Delete(":id") @HttpCode(204) delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.delete(id); }
}
