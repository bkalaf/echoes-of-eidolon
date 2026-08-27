import { managedAssetRecord } from "./managed-assets";

const atlasTextureKeys = {
  albedo: "atlas.nimbus.globe-albedo",
  "region-tint": "atlas.nimbus.region-tint",
} as const;
const productionOrigin = "https://app.eidolon-gaming.com";

export type AtlasTextureKind = keyof typeof atlasTextureKeys;

export function atlasTextureRecord(kind: AtlasTextureKind) {
  return managedAssetRecord(atlasTextureKeys[kind]);
}

export function atlasTextureUrl(kind: AtlasTextureKind, origin = typeof window === "undefined" ? undefined : window.location.origin): string {
  const record = atlasTextureRecord(kind);
  if (origin === productionOrigin) return record.publicUrl;
  return `/api/atlas/texture?kind=${kind}&sha256=${record.sha256}`;
}

export function isAtlasTextureKind(value: string | null): value is AtlasTextureKind {
  return value === "albedo" || value === "region-tint";
}
