"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  createResumeDocumentFromFile,
  createResumeDocumentFromText,
  deleteResumeDocument,
  listResumeDocuments,
  type ResumeDocument,
  type ResumeDocumentSource,
} from "@/lib/resume-documents";
import { cn } from "@/lib/utils";

const listLimit = 8;

const sourceLabelMap: Record<ResumeDocumentSource, string> = {
  pasted: "粘贴文本",
  uploaded: "上传文件",
};

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type TextFormState = {
  title: string;
  content: string;
  isPrimary: boolean;
};

type FileFormState = {
  title: string;
  isPrimary: boolean;
};

const defaultTextFormState: TextFormState = {
  title: "",
  content: "",
  isPrimary: false,
};

const defaultFileFormState: FileFormState = {
  title: "",
  isPrimary: false,
};

export function ResumeDocumentsSection() {
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [textForm, setTextForm] = useState<TextFormState>(defaultTextFormState);
  const [fileForm, setFileForm] = useState<FileFormState>(defaultFileFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isTextSubmitting, setIsTextSubmitting] = useState(false);
  const [isFileSubmitting, setIsFileSubmitting] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsListLoading(true);
    setListError(null);

    try {
      const response = await listResumeDocuments({
        limit: listLimit,
        offset: 0,
      });

      setDocuments(response.data.items);
      setTotal(response.data.pagination.total);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取原始资料列表，请确认后端服务已启动。";

      setDocuments([]);
      setTotal(0);
      setListError(message);
    } finally {
      setIsListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const primaryCount = useMemo(
    () => documents.filter((document) => document.isPrimary).length,
    [documents],
  );

  const handleTextSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!textForm.content.trim()) {
        setActionState({
          type: "error",
          message: "请先粘贴简历原文内容。",
        });
        return;
      }

      setIsTextSubmitting(true);
      setActionState({ type: "idle" });

      try {
        const response = await createResumeDocumentFromText({
          title: normalizeOptionalText(textForm.title),
          content: textForm.content,
          isPrimary: textForm.isPrimary,
        });

        setTextForm(defaultTextFormState);
        await loadDocuments();
        setActionState({
          type: "success",
          message: "简历原文已入库。它不会自动进入项目经历，后续仍需你确认后再整理成 Project。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "text"));
      } finally {
        setIsTextSubmitting(false);
      }
    },
    [loadDocuments, textForm],
  );

  const handleFileSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedFile) {
        setActionState({
          type: "error",
          message: "请先选择一个 .txt、.md 或 .markdown 文件。",
        });
        return;
      }

      if (!isAllowedResumeTextFile(selectedFile.name)) {
        setActionState({
          type: "error",
          message: "当前只接受 .txt、.md、.markdown 原文文件。",
        });
        return;
      }

      setIsFileSubmitting(true);
      setActionState({ type: "idle" });

      try {
        const response = await createResumeDocumentFromFile({
          file: selectedFile,
          title: normalizeOptionalText(fileForm.title),
          isPrimary: fileForm.isPrimary,
        });

        setFileForm(defaultFileFormState);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        await loadDocuments();
        setActionState({
          type: "success",
          message: "原始资料文件已入库。它不会自动生成项目经历，后续仍需你手动确认整理。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "file"));
      } finally {
        setIsFileSubmitting(false);
      }
    },
    [fileForm, loadDocuments, selectedFile],
  );

  const handleDelete = useCallback(
    async (document: ResumeDocument) => {
      setDeletingDocumentId(document.id);
      setActionState({ type: "idle" });

      try {
        const response = await deleteResumeDocument(document.id);
        await loadDocuments();
        setActionState({
          type: "success",
          message: `已删除原始资料「${document.title?.trim() || "未命名资料"}」。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "delete"));
      } finally {
        setDeletingDocumentId(null);
      }
    },
    [loadDocuments],
  );

  const isBusy =
    isListLoading || isTextSubmitting || isFileSubmitting || deletingDocumentId !== null;

  return (
    <SectionCard
      title="简历导入 / 原始资料"
      eyebrow="Resume Documents"
      description="这里只存放简历原文与原始资料，不会自动写入项目经历；后续仍需你确认后，再整理成 Project。"
      actions={
        <Button type="button" variant="ghost" disabled={isBusy} onClick={() => void loadDocuments()}>
          刷新
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
          适合先把完整简历原文、历史版本或零散素材放进这里。这个区块只是原文库，不会替你自动生成
          Project，也不会直接覆盖现有项目经历。
        </div>

        {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <form className="space-y-4 rounded-lg border border-white/10 bg-background/40 p-4" onSubmit={handleTextSubmit}>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">粘贴简历文本</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                适合直接收纳现有简历原文。这里只保存原文，不会自动拆成项目条目。
              </p>
            </div>

            <TextField
              id="resume-text-title"
              label="标题（可选）"
              value={textForm.title}
              onChange={(value) => setTextForm((current) => ({ ...current, title: value }))}
              placeholder="例如：2026 春招简历原稿"
            />

            <TextAreaField
              id="resume-text-content"
              label="简历文本"
              value={textForm.content}
              onChange={(value) => setTextForm((current) => ({ ...current, content: value }))}
              placeholder="粘贴完整简历原文或待整理资料。"
              minHeightClassName="min-h-40"
            />

            <CheckboxField
              id="resume-text-primary"
              label="设为主要原始资料"
              checked={textForm.isPrimary}
              onChange={(checked) => setTextForm((current) => ({ ...current, isPrimary: checked }))}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isTextSubmitting}>
                {isTextSubmitting ? "导入中..." : "保存文本"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isTextSubmitting}
                onClick={() => setTextForm(defaultTextFormState)}
              >
                清空
              </Button>
            </div>
          </form>

          <form className="space-y-4 rounded-lg border border-white/10 bg-background/40 p-4" onSubmit={handleFileSubmit}>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">上传原文文件</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                仅接受 .txt、.md、.markdown。上传后只会进入原始资料库，不会自动生成项目经历。
              </p>
            </div>

            <TextField
              id="resume-file-title"
              label="标题（可选）"
              value={fileForm.title}
              onChange={(value) => setFileForm((current) => ({ ...current, title: value }))}
              placeholder="默认会从文件名推导"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="resume-file-upload">
                原文文件
              </label>
              <input
                ref={fileInputRef}
                id="resume-file-upload"
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-foreground"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                当前只收原文文本文件。后续即使需要整理成项目，也仍需你手动确认。
              </p>
            </div>

            <CheckboxField
              id="resume-file-primary"
              label="设为主要原始资料"
              checked={fileForm.isPrimary}
              onChange={(checked) => setFileForm((current) => ({ ...current, isPrimary: checked }))}
            />

            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {selectedFile
                ? `已选择：${selectedFile.name}`
                : "还没有选择文件。"}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isFileSubmitting}>
                {isFileSubmitting ? "上传中..." : "上传文件"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isFileSubmitting}
                onClick={() => {
                  setFileForm(defaultFileFormState);
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                清空
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="最近展示" value={`${documents.length}`} helper={`最多 ${listLimit} 条`} />
            <StatCard label="原始资料总数" value={`${total}`} helper="来自 GET /api/resume-documents" />
            <StatCard label="主要资料" value={`${primaryCount}`} helper="用于标记当前主版本" />
          </div>

          {listError ? <ErrorState message={listError} /> : null}

          {!listError && isListLoading ? (
            <EmptyState text="正在读取最近导入的原始资料..." />
          ) : null}

          {!listError && !isListLoading && documents.length === 0 ? (
            <EmptyState text="还没有导入任何简历原文。可以先粘贴文本，或上传一个 .txt / .md / .markdown 文件。" />
          ) : null}

          {!listError && !isListLoading && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((document) => {
                const isDeleting = deletingDocumentId === document.id;
                const preview = summarizeContent(document.content);

                return (
                  <article
                    key={document.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold tracking-tight text-foreground">
                            {document.title?.trim() || "未命名资料"}
                          </h3>
                          <MetaBadge text={sourceLabelMap[document.source]} tone="sky" />
                          {document.isPrimary ? (
                            <MetaBadge text="主要资料" tone="emerald" />
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoBlock label="来源" value={sourceLabelMap[document.source]} />
                          <InfoBlock
                            label="更新时间"
                            value={formatDateTime(document.updatedAt) ?? "未知时间"}
                          />
                        </div>

                        <InfoBlock label="内容预览" value={preview} multiline />
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(document)}
                        >
                          {isDeleting ? "删除中..." : "删除"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minHeightClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeightClassName: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20",
          minHeightClassName,
        )}
      />
    </div>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-background/50"
      />
      <span className="leading-6 text-muted-foreground">{label}</span>
    </label>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-sm text-foreground",
          multiline ? "leading-7 text-muted-foreground" : "leading-6",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MetaBadge({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "emerald" | "sky";
}) {
  const classNameMap = {
    default: "border-white/10 bg-background/50 text-muted-foreground",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    sky: "border-sky-500/20 bg-sky-500/10 text-foreground",
  } as const;

  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs", classNameMap[tone])}>{text}</span>
  );
}

function FeedbackBanner({ state }: { state: Exclude<ActionState, { type: "idle" }> }) {
  const toneClassName =
    state.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : "border-rose-500/20 bg-rose-500/10";

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm text-foreground", toneClassName)}>
      <p className="font-medium text-foreground">
        {state.type === "success" ? "操作成功" : "操作失败"}
      </p>
      <p className="mt-1 leading-6 text-muted-foreground">
        {state.message}
        {state.requestId ? `（requestId: ${state.requestId}）` : ""}
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-foreground">
      {message}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isAllowedResumeTextFile(fileName: string) {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith(".txt") || normalized.endsWith(".md") || normalized.endsWith(".markdown");
}

function summarizeContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "内容为空";
  }

  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 180)}...`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toActionError(
  error: unknown,
  source: "text" | "file" | "delete",
): Exclude<ActionState, { type: "idle" }> {
  if (error instanceof ApiClientError) {
    if (source === "file" && error.status === 415) {
      return {
        type: "error",
        message: "当前只接受 .txt、.md、.markdown 原文文件。",
        requestId: error.requestId,
      };
    }

    if (source === "file" && error.status === 413) {
      return {
        type: "error",
        message: "文件过大，请压缩后再试。",
        requestId: error.requestId,
      };
    }

    return {
      type: "error",
      message: error.message,
      requestId: error.requestId,
    };
  }

  const fallbackMessageMap = {
    text: "保存简历原文失败，请稍后重试。",
    file: "上传原始资料失败，请稍后重试。",
    delete: "删除原始资料失败，请稍后重试。",
  } as const;

  return {
    type: "error",
    message: fallbackMessageMap[source],
  };
}
