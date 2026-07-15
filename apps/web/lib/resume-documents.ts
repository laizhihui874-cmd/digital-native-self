import { apiRequest } from "@/lib/api-client";

export const resumeDocumentSourceValues = ["pasted", "uploaded"] as const;

export type ResumeDocumentSource = (typeof resumeDocumentSourceValues)[number];

export type ResumeDocument = {
  id: string;
  userId: string;
  importedFileId?: string | null;
  source: ResumeDocumentSource;
  title?: string | null;
  content: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ListResumeDocumentsResponse = {
  items: ResumeDocument[];
  pagination: PaginationMeta;
};

export type CreateResumeDocumentTextInput = {
  title?: string;
  content: string;
  isPrimary?: boolean;
};

export type CreateResumeDocumentFileInput = {
  file: File;
  title?: string;
  isPrimary?: boolean;
};

export async function createResumeDocumentFromText(input: CreateResumeDocumentTextInput) {
  return apiRequest<ResumeDocument>("/api/resume-documents/text", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createResumeDocumentFromFile(input: CreateResumeDocumentFileInput) {
  const formData = new FormData();
  formData.set("file", input.file);

  if (typeof input.title === "string") {
    formData.set("title", input.title);
  }

  if (typeof input.isPrimary === "boolean") {
    formData.set("isPrimary", String(input.isPrimary));
  }

  return apiRequest<ResumeDocument>("/api/resume-documents/file", {
    method: "POST",
    body: formData,
  });
}

export async function listResumeDocuments(params: { limit?: number; offset?: number } = {}) {
  const searchParams = new URLSearchParams();

  if (typeof params.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListResumeDocumentsResponse>(
    `/api/resume-documents${query ? `?${query}` : ""}`,
  );
}

export async function deleteResumeDocument(id: string) {
  return apiRequest<null>(
    `/api/resume-documents/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
