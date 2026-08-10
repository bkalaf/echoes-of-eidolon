import { pageManifest, pathMatches, shellFor } from "./page-manifest";

const explicitlyPublicPaths = ["/about", "/features/free-to-play"] as const;

const crawlablePatterns = pageManifest
  .filter((entry) => entry.path !== null && ["public", "store"].includes(shellFor(entry)))
  .map((entry) => entry.path!.split("?")[0]!)
  .filter((path) => !path.startsWith("/store/orders/"));

export const sitemapPaths = Object.freeze(
  [...new Set([...crawlablePatterns.filter((path) => !path.includes(":")), ...explicitlyPublicPaths])]
    .sort(),
);

export function isCrawlablePath(pathname: string): boolean {
  const normalized = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  return explicitlyPublicPaths.includes(normalized as (typeof explicitlyPublicPaths)[number])
    || crawlablePatterns.some((pattern) => pathMatches(pattern, normalized));
}

export function robotsDocument(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /auth",
    "Disallow: /account",
    "Disallow: /admin",
    "Disallow: /game",
    "Disallow: /review",
    "Disallow: /store/orders/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapDocument(origin: string): string {
  const urls = sitemapPaths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
