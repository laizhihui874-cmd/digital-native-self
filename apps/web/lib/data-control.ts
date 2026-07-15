import type { ArchiveExport, ArchiveRestoreMode, ArchiveRestorePreview, ArchiveRestoreResult, DataControlOverview, DeleteAiDataRequest, DeleteAiDataResponse } from "@digital-self/shared";

import { apiRequest } from "@/lib/api-client";

export function getDataControlOverview() {
  return apiRequest<DataControlOverview>("/api/data-control");
}

export function exportArchive() {
  return apiRequest<ArchiveExport>("/api/data-control/archive-export");
}

export async function exportArchiveBundle(): Promise<Blob> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/data-control/archive-export.zip`, { cache: "no-store" });
  if (!response.ok) throw new Error("生成完整档案包失败。");
  return response.blob();
}

export function previewArchiveRestore(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<ArchiveRestorePreview>("/api/data-control/restore-preview", { method: "POST", body });
}

export function restoreArchive(file: File, mode: ArchiveRestoreMode, confirmationText?: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("mode", mode);
  if (confirmationText) body.append("confirmationText", confirmationText);
  return apiRequest<ArchiveRestoreResult>("/api/data-control/restore", { method: "POST", body });
}

export function deleteAiData(input: DeleteAiDataRequest) {
  return apiRequest<DeleteAiDataResponse>("/api/data-control/ai-data", { method: "DELETE", body: JSON.stringify(input) });
}
