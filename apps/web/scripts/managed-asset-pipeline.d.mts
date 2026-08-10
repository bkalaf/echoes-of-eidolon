export function normalizeManagedExtension(extension: string): string;
export function assertManagedAssetSignature(bytes: Uint8Array, extension: string): void;
export function finalByteIdentity(bytes: Uint8Array, extension: string): {
  fileName: string;
  sha256: string;
};
