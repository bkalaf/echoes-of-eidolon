const defaultSignedInPath = "/account/profile";

export function safeSignedInReturnPath(candidate: string | null | undefined, origin: string): string {
  if (!candidate) return defaultSignedInPath;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return defaultSignedInPath;
  try {
    const target = new URL(candidate, origin);
    if (target.origin !== origin || !target.pathname.startsWith("/")) return defaultSignedInPath;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return defaultSignedInPath;
  }
}
