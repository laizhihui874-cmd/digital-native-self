import type {
  CreateTextEvidenceArtifactRequest,
  AppendParsedEvidenceRevisionRequest,
  EvidenceArtifactDetail,
  ListEvidenceArtifactsResponse,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  MAX_IMPORTED_FILE_BYTES,
  resolveImportedFileType,
  type UploadedBinaryFile,
} from "../imported-files/imported-files.service";
import { parseImportedFileText } from "../imported-files/resume-file-parser";
import { mapEvidenceArtifact, mapEvidenceArtifactDetail } from "./evidence.mapper";

@Injectable()
export class EvidenceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
  ) {}

  async createText(input: CreateTextEvidenceArtifactRequest): Promise<EvidenceArtifactDetail> {
    const userId = await this.identity.getCurrentUserId();
    const contentHash = createHash("sha256").update(input.content, "utf8").digest("hex");
    const record = await this.prisma.evidenceArtifact.create({
      data: {
        userId,
        artifactType: "pasted_text",
        title: input.title,
        mimeType: "text/plain",
        privacyLevel: input.privacyLevel ?? "private",
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
        revisions: {
          create: {
            revisionNumber: 1,
            revisionType: "original",
            contentHash,
            content: input.content,
            fragments: {
              create: {
                fragmentIndex: 0,
                content: input.content,
                startOffset: 0,
                endOffset: input.content.length,
                locator: { kind: "character_range", start: 0, end: input.content.length },
              },
            },
          },
        },
      },
      include: { revisions: { include: { fragments: true }, orderBy: { revisionNumber: "asc" } } },
    });
    return mapEvidenceArtifactDetail(record);
  }

  async createFile(file: UploadedBinaryFile): Promise<EvidenceArtifactDetail> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("A non-empty file upload is required.");
    }
    if (file.buffer.length > MAX_IMPORTED_FILE_BYTES) {
      throw new PayloadTooLargeException(
        `Uploaded file exceeds the ${MAX_IMPORTED_FILE_BYTES} byte limit.`,
      );
    }

    const userId = await this.identity.getCurrentUserId();
    const artifactId = randomUUID();
    const fileType = resolveImportedFileType(file.originalname, file.mimetype);
    const parsedText = await parseImportedFileText(fileType, file.buffer);
    if (parsedText.trim().length === 0) {
      throw new BadRequestException("Uploaded file content must not be empty.");
    }
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const storageRoot = path.resolve(process.env.STORAGE_DIR?.trim() || "./storage");
    const artifactDirectory = path.join(storageRoot, "evidence", userId, artifactId);
    const extension = path.extname(file.originalname).toLowerCase() || ".bin";
    const storagePath = path.join(artifactDirectory, `original${extension}`);
    const storedReference = path.relative(process.cwd(), storagePath);

    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(storagePath, file.buffer, { flag: "wx" });
    try {
      const record = await this.prisma.evidenceArtifact.create({
        data: {
          id: artifactId,
          userId,
          artifactType: "uploaded_file",
          title: file.originalname,
          mimeType: file.mimetype || undefined,
          revisions: {
            create: [
              {
                revisionNumber: 1,
                revisionType: "original",
                contentHash,
                content: fileType === "txt" || fileType === "markdown" ? file.buffer.toString("utf8") : null,
                storagePath: storedReference,
              },
              {
                revisionNumber: 2,
                revisionType: "parsed",
                contentHash: createHash("sha256").update(parsedText, "utf8").digest("hex"),
                content: parsedText,
                parserVersion: `local-${fileType}/1`,
                fragments: {
                  create: {
                    fragmentIndex: 0,
                    content: parsedText,
                    startOffset: 0,
                    endOffset: parsedText.length,
                    locator: { kind: "character_range", start: 0, end: parsedText.length },
                  },
                },
              },
            ],
          },
        },
        include: { revisions: { include: { fragments: true }, orderBy: { revisionNumber: "asc" } } },
      });
      return mapEvidenceArtifactDetail(record);
    } catch (error) {
      await rm(artifactDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  async list(query: { limit?: number; offset?: number }): Promise<ListEvidenceArtifactsResponse> {
    const userId = await this.identity.getCurrentUserId();
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.evidenceArtifact.count({ where: { userId } }),
      this.prisma.evidenceArtifact.findMany({
        where: { userId },
        orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);
    return { items: items.map(mapEvidenceArtifact), pagination: { total, limit, offset } };
  }

  async appendParsedRevision(
    id: string,
    input: AppendParsedEvidenceRevisionRequest,
  ): Promise<EvidenceArtifactDetail> {
    const userId = await this.identity.getCurrentUserId();
    return this.prisma.$transaction(async (tx) => {
      const artifact = await tx.evidenceArtifact.findFirst({ where: { id, userId } });
      if (!artifact) throw new NotFoundException(`EvidenceArtifact ${id} was not found.`);
      const revisionNumber = (await tx.evidenceRevision.count({ where: { artifactId: id } })) + 1;
      const contentHash = createHash("sha256").update(input.content, "utf8").digest("hex");
      await tx.evidenceRevision.create({
        data: {
          artifactId: id,
          revisionNumber,
          revisionType: "parsed",
          contentHash,
          content: input.content,
          parserVersion: input.parserVersion,
          fragments: {
            create: {
              fragmentIndex: 0,
              content: input.content,
              startOffset: 0,
              endOffset: input.content.length,
              locator: { kind: "character_range", start: 0, end: input.content.length },
            },
          },
        },
      });
      const updated = await tx.evidenceArtifact.findUniqueOrThrow({
        where: { id },
        include: { revisions: { include: { fragments: true }, orderBy: { revisionNumber: "asc" } } },
      });
      return mapEvidenceArtifactDetail(updated);
    });
  }

  async findById(id: string): Promise<EvidenceArtifactDetail> {
    const userId = await this.identity.getCurrentUserId();
    const record = await this.prisma.evidenceArtifact.findFirst({
      where: { id, userId },
      include: { revisions: { include: { fragments: true }, orderBy: { revisionNumber: "asc" } } },
    });
    if (!record) throw new NotFoundException(`EvidenceArtifact ${id} was not found.`);
    return mapEvidenceArtifactDetail(record);
  }
}
