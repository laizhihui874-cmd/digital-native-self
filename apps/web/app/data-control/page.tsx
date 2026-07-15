"use client";

import type { ArchiveRestoreMode, ArchiveRestorePreview, ArchiveRestoreResult, DataControlOverview } from "@digital-self/shared";
import { useEffect, useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { deleteAiData, exportArchiveBundle, getDataControlOverview, previewArchiveRestore, restoreArchive } from "@/lib/data-control";

export default function DataControlPage() {
  const [overview, setOverview] = useState<DataControlOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ArchiveRestorePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<ArchiveRestoreMode>("merge_skip");
  const [confirmationText, setConfirmationText] = useState("");
  const [restoreResult, setRestoreResult] = useState<ArchiveRestoreResult | null>(null);

  useEffect(() => {
    getDataControlOverview()
      .then((result) => setOverview(result.data))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "读取数据设置失败。"));
  }, []);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await exportArchiveBundle();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `digital-self-archive-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("完整档案包已生成，内含 archive.json 和当前能读取到的原始上传文件。 ");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出档案失败。 ");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview(file?: File) {
    if (!file) return;
    setPreviewBusy(true);
    setRestoreFile(file);
    setRestoreResult(null);
    setPreview(null);
    setError(null);
    try {
      const result = await previewArchiveRestore(file);
      setPreview(result.data);
      setMessage("档案包已完成只读检查，没有写入数据库。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "检查档案包失败。");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile || !preview?.supported) return;
    if (restoreMode === "replace_all" && !window.confirm("这会用档案包替换当前全部档案。程序会先自动备份。继续吗？")) return;
    setBusy(true); setError(null); setMessage(null); setRestoreResult(null);
    try {
      const result = await restoreArchive(restoreFile, restoreMode, confirmationText);
      setRestoreResult(result.data);
      setMessage(`恢复完成：导入 ${result.data.imported} 条，跳过 ${result.data.skipped} 条，替换 ${result.data.replaced} 条，文件 ${result.data.filesRestored} 个。`);
      setPreview(null);
      setRestoreFile(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "恢复档案失败，数据库和新文件已回滚。"); }
    finally { setBusy(false); }
  }

  async function handleDeleteAiData(kind: "conversations" | "callLogs" | "settings") {
    const labels = { conversations: "全部 AI 对话", callLogs: "全部档案助手调用记录", settings: "AI 设置和钥匙串密钥" };
    if (!window.confirm(`删除${labels[kind]}？这个操作不能撤销。`)) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await deleteAiData({ [kind]: true });
      setMessage(`删除完成：对话 ${result.data.conversationsDeleted} 个，消息 ${result.data.messagesDeleted} 条，调用记录 ${result.data.callLogsDeleted} 条，设置 ${result.data.settingsDeleted} 项。`);
      setOverview((await getDataControlOverview()).data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除 AI 数据失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <PageHeader
        eyebrow="Data Control"
        title="数据与隐私"
        description="查看哪些功能只在本机处理，哪些功能可能把内容发给外部服务，并导出自己的档案。"
      />

      {(message || error) && (
        <div className={`border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {error ?? message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card/70 px-4 py-3 text-sm">
        <span>档案助手的服务、模型、发送同意和密钥撤销在独立设置页管理。</span>
        <Link href="/settings/ai" className="font-medium text-primary underline-offset-4 hover:underline">打开 AI 设置</Link>
      </div>

      <SectionCard title="删除 AI 数据" eyebrow="AI data" description="分别清理本机对话、调用记录或模型设置。正式档案不会被删除。">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteAiData("conversations")}>删除全部 AI 对话</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteAiData("callLogs")}>删除调用记录</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteAiData("settings")}>删除 AI 设置和密钥</Button>
        </div>
      </SectionCard>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="处理位置" eyebrow="Processing" description="外部处理默认关闭；只有本机环境明确允许后才会发出请求。">
          {!overview && !error && <p className="text-sm text-muted-foreground">正在读取处理方式…</p>}
          <div className="space-y-3">
            {overview?.capabilities.map((item) => (
              <article key={item.id} className="border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">{item.label}</h2>
                  <span className={`px-2 py-1 text-xs ${item.processingLocation === "local" ? "bg-emerald-50 text-emerald-800" : item.enabled ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                    {item.processingLocation === "local" ? "仅本机" : item.enabled ? "外部处理已允许" : "外部处理已关闭"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">提供器：{item.provider}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="导出档案" eyebrow="Export" description="导出 ZIP，方便自行保存和检查。">
          <p className="text-sm leading-6 text-muted-foreground">
            导出包包含 archive.json、每日记录、事件、记忆、来源片段、项目、能力、决策、周复盘、版本历史，以及当前能读取到的原始上传文件。
          </p>
          <Button type="button" className="mt-5" onClick={() => void handleExport()} disabled={busy}>
            {busy ? "正在生成…" : "导出完整档案包"}
          </Button>
        </SectionCard>
      </section>

      <SectionCard title="档案恢复" eyebrow="Restore" description="先检查档案包，再选择跳过冲突或替换当前全部档案。替换前会自动生成完整备份。">
        <label className="block border border-dashed border-border bg-muted/20 p-5 text-sm">
          <span className="font-medium">选择数字人生档案 ZIP</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">支持当前程序导出的档案包，文件上限 50MB。</span>
          <input
            aria-label="选择要检查的档案包"
            type="file"
            accept=".zip,application/zip"
            disabled={previewBusy}
            onChange={(event) => void handlePreview(event.target.files?.[0])}
            className="mt-4 block w-full text-sm"
          />
        </label>
        {previewBusy && <p className="mt-4 text-sm text-muted-foreground">正在检查档案结构和冲突…</p>}
        {preview && (
          <div className="mt-5 space-y-4" aria-label="档案恢复预览结果">
            <div className="grid gap-3 sm:grid-cols-4">
              <PreviewMetric label="档案版本" value={preview.schemaVersion} />
              <PreviewMetric label="记录总数" value={String(preview.totalRecords)} />
              <PreviewMetric label="包内原件" value={String(preview.bundleFileCount)} />
              <PreviewMetric label="ID 冲突" value={String(preview.conflictCount)} />
            </div>
            <p className={`border px-4 py-3 text-sm ${preview.canRestoreToEmptyDatabase ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
              {preview.canRestoreToEmptyDatabase
                ? "档案结构可识别，当前库没有个人记录，可以进入后续恢复流程。"
                : preview.supported
                  ? `档案结构可识别；当前库已有 ${preview.currentDatabase.recordCount} 条记录，需要先处理冲突或改用空库。`
                  : "档案版本与当前程序不兼容，不能进入恢复流程。"}
            </p>
            <details className="border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">查看各类记录数量</summary>
              <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
                {Object.entries(preview.collectionCounts).map(([name, count]) => (
                  <div key={name} className="flex justify-between gap-3 border-b border-border/60 py-1"><dt>{name}</dt><dd>{count}</dd></div>
                ))}
              </dl>
            </details>
            {(preview.missingFiles.length > 0 || preview.warnings.length > 0) && (
              <div className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                <p className="font-medium">需要处理的内容</p>
                <ul className="mt-2 list-disc pl-5">
                  {preview.missingFiles.map((item) => <li key={`missing-${item}`}>缺失原件：{item}</li>)}
                  {preview.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {preview.supported && (
              <div className="space-y-4 border border-border bg-card p-4">
                <fieldset className="space-y-2"><legend className="text-sm font-medium">恢复方式</legend><label className="flex gap-2 text-sm"><input type="radio" name="restore-mode" checked={restoreMode === "merge_skip"} onChange={() => setRestoreMode("merge_skip")} />合并并跳过冲突，不覆盖已有记录</label><label className="flex gap-2 text-sm"><input type="radio" name="restore-mode" checked={restoreMode === "replace_all"} onChange={() => setRestoreMode("replace_all")} />替换当前全部档案，执行前自动备份</label></fieldset>
                {restoreMode === "replace_all" && <label className="block text-sm"><span className="font-medium">输入“替换我的全部档案”确认</span><input aria-label="替换确认文本" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className="mt-2 h-10 w-full border border-input bg-background px-3" /></label>}
                <Button type="button" disabled={busy || !restoreFile || (restoreMode === "replace_all" && confirmationText !== "替换我的全部档案")} onClick={() => void handleRestore()}>{busy ? "正在恢复…" : restoreMode === "replace_all" ? "备份并替换全部档案" : "合并并跳过冲突"}</Button>
              </div>
            )}
          </div>
        )}
        {restoreResult && <div className="mt-5 space-y-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" aria-label="档案恢复结果"><p className="font-medium">恢复结果</p><p>导入 {restoreResult.imported} 条，跳过 {restoreResult.skipped} 条，替换 {restoreResult.replaced} 条，恢复文件 {restoreResult.filesRestored} 个，缺失文件 {restoreResult.missingFiles.length} 个，失败 {restoreResult.failed} 条。</p>{restoreResult.backupPath && <p className="break-all text-xs">执行前备份：{restoreResult.backupPath}</p>}</div>}
      </SectionCard>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>;
}
