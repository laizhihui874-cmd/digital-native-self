import { ForbiddenException } from "@nestjs/common";

export function isExternalProcessingExplicitlyAllowed(): boolean {
  return process.env.ALLOW_EXTERNAL_PROCESSING?.trim() === "1";
}

export function assertExternalProcessingAllowed(feature: string): void {
  if (isExternalProcessingExplicitlyAllowed()) return;
  throw new ForbiddenException(
    `${feature} would send data outside this computer. Set ALLOW_EXTERNAL_PROCESSING=1 only after reviewing the provider and data being sent.`,
  );
}
