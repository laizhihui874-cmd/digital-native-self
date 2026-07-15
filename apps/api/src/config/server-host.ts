const allowedLoopbackHosts = new Set(["127.0.0.1", "::1"]);

export function resolveApiHost(value: string | undefined): string {
  const host = value?.trim() || "127.0.0.1";

  if (!allowedLoopbackHosts.has(host)) {
    throw new Error(
      `API_HOST=${host} is not allowed while the application uses local single-user identity. Use 127.0.0.1 or ::1.`,
    );
  }

  return host;
}
