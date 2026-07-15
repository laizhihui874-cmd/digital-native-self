import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "digital-self-ai";

export type CredentialSource = "keychain" | "environment" | "none";

@Injectable()
export class CredentialStoreService {
  private environmentApiKey(): string | null {
    return process.env.AI_PROVIDER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || null;
  }

  async save(userId: string, apiKey: string): Promise<string> {
    const value = apiKey.trim();
    if (!value) throw new ServiceUnavailableException("API 密钥不能为空。");
    if (process.platform !== "darwin") {
      throw new ServiceUnavailableException("当前系统无法使用 macOS 钥匙串，请通过 AI_PROVIDER_API_KEY 提供密钥。");
    }

    await execFileAsync("security", [
      "add-generic-password",
      "-a",
      userId,
      "-s",
      KEYCHAIN_SERVICE,
      "-w",
      value,
      "-U",
    ]);
    return `${KEYCHAIN_SERVICE}:${userId}`;
  }

  async read(userId: string, credentialRef?: string | null): Promise<{ apiKey: string | null; source: CredentialSource }> {
    const environmentApiKey = this.environmentApiKey();
    if (environmentApiKey) return { apiKey: environmentApiKey, source: "environment" };
    if (!credentialRef || process.platform !== "darwin") return { apiKey: null, source: "none" };

    try {
      const result = await execFileAsync("security", [
        "find-generic-password",
        "-a",
        userId,
        "-s",
        KEYCHAIN_SERVICE,
        "-w",
      ]);
      const apiKey = result.stdout.trim();
      return apiKey ? { apiKey, source: "keychain" } : { apiKey: null, source: "none" };
    } catch {
      return { apiKey: null, source: "none" };
    }
  }

  async delete(userId: string, credentialRef?: string | null): Promise<void> {
    if (!credentialRef || process.platform !== "darwin") return;
    try {
      await execFileAsync("security", [
        "delete-generic-password",
        "-a",
        userId,
        "-s",
        KEYCHAIN_SERVICE,
      ]);
    } catch {
      // A missing keychain item already satisfies the deletion request.
    }
  }
}
