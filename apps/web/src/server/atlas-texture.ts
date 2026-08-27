import { atlasTextureRecord, isAtlasTextureKind } from "../content/atlas-textures";

type TextureFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function deliverAtlasTexture(requestUrl: URL, fetcher: TextureFetcher = fetch): Promise<Response> {
  const kind = requestUrl.searchParams.get("kind");
  if (!isAtlasTextureKind(kind)) return new Response("Atlas texture not found.", { status: 404 });

  const record = atlasTextureRecord(kind);
  if (requestUrl.searchParams.get("sha256") !== record.sha256) {
    return new Response("Atlas texture not found.", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetcher(record.publicUrl);
  } catch {
    return new Response("Atlas texture delivery is unavailable.", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Atlas texture delivery is unavailable.", { status: 502 });
  }

  const headers = new Headers({
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": record.mimeType,
    "cross-origin-resource-policy": "same-origin",
    etag: `"${record.sha256}"`,
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  return new Response(upstream.body, { headers, status: 200 });
}
