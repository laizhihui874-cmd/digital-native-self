import { existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRootEnvPath = resolve(__dirname, "../../../../.env");

export function loadRootEnv(): void {
  if (!existsSync(projectRootEnvPath)) {
    return;
  }

  process.loadEnvFile(projectRootEnvPath);
}
