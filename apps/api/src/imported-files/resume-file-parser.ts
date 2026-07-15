import { UnprocessableEntityException } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";

import type { ImportedFileType } from "@digital-self/shared";

export async function parseImportedFileText(
  fileType: ImportedFileType,
  buffer: Buffer,
): Promise<string> {
  switch (fileType) {
    case "txt":
    case "markdown":
      return decodeUtf8Text(buffer);
    case "pdf":
      return parsePdfText(buffer);
    case "word":
      return parseWordText(buffer);
    default:
      return assertNever(fileType);
  }
}

export const parseResumeFileText = parseImportedFileText;

function decodeUtf8Text(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

async function parsePdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new UnprocessableEntityException(
      `PDF import failed: ${formatParseError(error)}`,
    );
  } finally {
    await parser.destroy();
  }
}

async function parseWordText(buffer: Buffer): Promise<string> {
  if (!isZipBasedDocx(buffer)) {
    throw new UnprocessableEntityException(
      "Legacy .doc import is recognized but cannot be parsed reliably yet. Upload .docx, .pdf, .txt, .md, or .markdown.",
    );
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new UnprocessableEntityException(
      `Word import failed: ${formatParseError(error)}`,
    );
  }
}

function isZipBasedDocx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function formatParseError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "unable to extract text from the uploaded file";
}

function assertNever(value: never): never {
  throw new UnprocessableEntityException(`Unsupported imported file type: ${String(value)}`);
}
