import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const supportedExtensions = new Set([".jpg", ".jpeg", ".mp3", ".mp4", ".png"]);

export function normalizeManagedExtension(extension) {
  const normalized = extension.toLowerCase();
  if (!supportedExtensions.has(normalized)) {
    throw new Error(`Unsupported managed asset extension: ${extension}`);
  }
  return normalized === ".jpeg" ? ".jpg" : normalized;
}

export function assertManagedAssetSignature(bytes, extension) {
  const normalized = extension.toLowerCase();
  normalizeManagedExtension(normalized);
  const matches = normalized === ".png"
    ? bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : normalized === ".jpg" || normalized === ".jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : normalized === ".mp4"
        ? bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp"
        : bytes.length >= 3 && (
          Buffer.from(bytes.subarray(0, 3)).toString("ascii") === "ID3" ||
          (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
        );

  if (!matches) {
    throw new Error(`Managed asset signature does not match ${extension}`);
  }
}

export function finalByteIdentity(bytes, extension) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    fileName: `${sha256}${normalizeManagedExtension(extension)}`,
    sha256,
  };
}
