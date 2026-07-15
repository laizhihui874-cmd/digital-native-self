"use client";

import type { AiSettings } from "@digital-self/shared";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { getAiSettings, testAiSettings, updateAiSettings } from "@/lib/ai";

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [analysisModel, setAnalysisModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<Partial<Record<"fast" | "analysis", string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiSettings().then(({ data }) => {
      setSettings(data); setBaseUrl(data.baseUrl); setFastModel(data.fastModel); setAnalysisModel(data.analysisModel);
      setEnabled(data.enabled); setConsent(Boolean(data.externalProcessingConsentAt));
    }).catch((cause) => setError(errorText(cause, "读取 AI 设置失败。")));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNotices({});
    try {
      const { data } = await updateAiSettings({ baseUrl, fastModel, analysisModel, apiKey: apiKey || undefined, enabled, externalProcessingConsent: consent });
      setSettings(data); setApiKey(""); setNotices({ fast: "设置已保存。API 密钥没有写入个人数据库。" });
    } catch (cause) { setError(errorText(cause, "保存 AI 设置失败。")); } finally { setBusy(false); }
  }

  async function testConnection(slot: "fast" | "analysis") {
    setBusy(true); setError(null); setNotices((current) => ({ ...current, [slot]: undefined }));
    try {
      const { data } = await testAiSettings(slot);
      const tokens = data.usage?.totalTokens == null ? "token 未返回" : `${data.usage.totalTokens} token`;
      setNotices((current) => ({ ...current, [slot]: `${data.slot === "fast" ? "快速" : "分析"}模型连接成功：${data.model}，${data.latencyMs}ms，${tokens}，结果：${data.result}` }));
    }
    catch (cause) { setError(errorText(cause, "连接测试失败。")); } finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setError(null); setNotices({});
    try {
      const { data } = await updateAiSettings({ baseUrl, fastModel, analysisModel, enabled: false, externalProcessingConsent: false, removeCredential: true });
      setSettings(data); setEnabled(false); setConsent(false); setApiKey(""); setNotices({ fast: "云端处理权限已撤销，钥匙串中的密钥已删除。" });
    } catch (cause) { setError(errorText(cause, "撤销权限失败。")); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-7">
      <PageHeader eyebrow="AI settings" title="档案助手设置" description="配置一个 OpenAI 兼容服务。密钥进入 macOS 钥匙串，个人数据库只保存模型和服务地址。" />
      {(notices.fast || notices.analysis || error) && <div role="status" className={`space-y-1 border px-4 py-3 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100" : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"}`}>{error ? <p>{error}</p> : <>{notices.fast && <p>{notices.fast}</p>}{notices.analysis && <p>{notices.analysis}</p>}</>}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="模型服务" eyebrow="Provider" description="快速模型只用于连接测试和检索扩词；分析模型用于有引用的回答。">
          {!settings ? <p className="text-sm text-muted-foreground">正在读取设置…</p> : (
            <form className="space-y-5" onSubmit={save}>
              <Field label="OpenAI 兼容服务地址"><input required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="https://api.example.com/v1" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="快速模型"><input required value={fastModel} onChange={(event) => setFastModel(event.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
                <Field label="分析模型"><input required value={analysisModel} onChange={(event) => setAnalysisModel(event.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
              </div>
              <Field label="API 密钥" hint={settings.hasCredential ? `已有密钥（来源：${settings.credentialSource === "environment" ? "环境变量" : "macOS 钥匙串"}），留空不会替换。` : "保存后不会再次显示。"}>
                <input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder={settings.hasCredential ? "••••••••" : "输入 API 密钥"} />
              </Field>
              <label className="flex gap-3 border border-border bg-muted/25 p-4 text-sm leading-6"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4" /><span>我同意在提问时，把当前问题、最近 6 条对话消息和最多 8 个相关档案片段发送到上面配置的模型服务。检索扩词只发送问题，不发送档案。</span></label>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4" />启用档案助手云端回答</label>
              <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "正在处理…" : "保存设置"}</Button><Button type="button" variant="secondary" disabled={busy || !settings.enabled} onClick={() => void testConnection("fast")}>测试快速模型</Button><Button type="button" variant="secondary" disabled={busy || !settings.enabled} onClick={() => void testConnection("analysis")}>测试分析模型</Button></div>
            </form>
          )}
        </SectionCard>
        <div className="space-y-6">
          <SectionCard title="发送范围" eyebrow="Disclosure">
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground"><li>不会发送完整数据库或完整文件。</li><li>不会提供系统工具、网页搜索或写档案权限。</li><li>回答只会保存为本机对话，不会自动变成长久记忆。</li></ul>
          </SectionCard>
          <SectionCard title="随时撤销" eyebrow="Control">
            <p className="text-sm leading-6 text-muted-foreground">撤销后，连接测试、扩词和问答都会停止外部调用，同时删除钥匙串密钥。</p>
            <Button type="button" variant="secondary" className="mt-4 w-full" disabled={busy || (!settings?.hasCredential && !settings?.enabled)} onClick={() => void revoke()}>撤销并删除密钥</Button>
            <Link href="/assistant" className="mt-3 block text-center text-sm text-primary underline-offset-4 hover:underline">返回档案助手</Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block space-y-2 text-sm"><span className="font-medium">{label}</span>{children}{hint && <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>}</label>; }
function errorText(value: unknown, fallback: string) { return value instanceof Error ? value.message : fallback; }
