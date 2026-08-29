export function isSupportedLinkedInJobsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const isLinkedInHost = url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
    return url.protocol === "https:" && isLinkedInHost && url.pathname.startsWith("/jobs/");
  } catch {
    return false;
  }
}
