import type { CreatePersonRequest, Person, UpdatePersonRequest } from "@digital-self/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Person as PrismaPerson } from "@prisma/client";
import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PeopleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService) {}
  async list(): Promise<Person[]> { const userId = await this.identity.getCurrentUserId(); return (await this.prisma.person.findMany({ where: { userId }, orderBy: [{ name: "asc" }, { createdAt: "desc" }] })).map(mapPerson); }
  async create(input: CreatePersonRequest): Promise<Person> { const userId = await this.identity.getCurrentUserId(); return mapPerson(await this.prisma.person.create({ data: { userId, name: input.name.trim(), relationship: input.relationship?.trim(), description: input.description?.trim(), firstMetAt: input.firstMetAt ? new Date(input.firstMetAt) : null } })); }
  async update(id: string, input: UpdatePersonRequest): Promise<Person> { const userId = await this.identity.getCurrentUserId(); const current = await this.prisma.person.findFirst({ where: { id, userId } }); if (!current) throw new NotFoundException(`Person ${id} was not found.`); return mapPerson(await this.prisma.person.update({ where: { id }, data: { name: input.name?.trim(), relationship: input.relationship?.trim(), description: input.description?.trim(), firstMetAt: input.firstMetAt ? new Date(input.firstMetAt) : undefined } })); }
  async delete(id: string): Promise<void> { const userId = await this.identity.getCurrentUserId(); await this.prisma.graphRelation.deleteMany({ where: { userId, OR: [{ sourceType: "person", sourceId: id }, { targetType: "person", targetId: id }] } }); const result = await this.prisma.person.deleteMany({ where: { id, userId } }); if (!result.count) throw new NotFoundException(`Person ${id} was not found.`); }
}
function mapPerson(value: PrismaPerson): Person { return { id: value.id, name: value.name, relationship: value.relationship ?? undefined, description: value.description ?? undefined, firstMetAt: value.firstMetAt?.toISOString(), createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() }; }
