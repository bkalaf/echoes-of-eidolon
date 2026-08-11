import type { PrismaClient } from "../generated/prisma/client";
import { StoreProductType } from "../generated/prisma/enums";
import { z } from "zod";

import { getDatabase } from "./database";

type Database = PrismaClient;
type CommerceDatabase = Pick<PrismaClient, "managedAsset" | "storeProduct" | "storeVariant">;

const requiredText = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max);
const optionalText = (label: string, max: number) => z.string().trim().max(max).nullable();

export const createStoreProductSchema = z.object({
  artworkAssetId: optionalText("Artwork asset identifier", 500),
  name: requiredText("Product name", 200),
  productType: z.enum(StoreProductType),
  storeProductId: requiredText("Product identifier", 200),
}).strict();

export const updateStoreProductSchema = z.object({
  active: z.boolean(),
  artworkAssetId: optionalText("Artwork asset identifier", 500),
  name: requiredText("Product name", 200),
  productType: z.enum(StoreProductType),
}).strict();

export const saveStoreVariantSchema = z.object({
  available: z.boolean(),
  color: optionalText("Color", 100),
  priceCents: z.number().int().min(1).max(100_000_000),
  printfulVariantReference: requiredText("Printful variant reference", 500),
  size: optionalText("Size", 100),
  storeVariantId: requiredText("Variant identifier", 200),
  stripePriceReference: requiredText("Stripe price reference", 500),
}).strict();

export class CommerceAdminConflictError extends Error {}
export class CommerceAdminNotFoundError extends Error {}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function assertImageAsset(artworkAssetId: string | null, database: CommerceDatabase) {
  if (!artworkAssetId) return;
  const asset = await database.managedAsset.findUnique({
    where: { managedAssetId: artworkAssetId },
    select: { mediaKind: true },
  });
  if (!asset) throw new CommerceAdminConflictError("The selected managed artwork asset does not exist.");
  if (asset.mediaKind !== "IMAGE") throw new CommerceAdminConflictError("Store artwork requires an IMAGE managed asset.");
}

export async function createStoreProduct(input: z.infer<typeof createStoreProductSchema>, database: Database = getDatabase()) {
  try {
    return await database.$transaction(async (transaction) => {
      await assertImageAsset(input.artworkAssetId, transaction);
      return transaction.storeProduct.create({ data: { ...input, active: false } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isUniqueConflict(error)) throw new CommerceAdminConflictError("Product identifier, name, and canonical category must be unique.");
    throw error;
  }
}

export async function updateStoreProduct(productId: string, input: z.infer<typeof updateStoreProductSchema>, database: Database = getDatabase()) {
  try {
    return await database.$transaction(async (transaction) => {
      await assertImageAsset(input.artworkAssetId, transaction);
      const existing = await transaction.storeProduct.findUnique({ where: { storeProductId: productId }, select: { storeProductId: true } });
      if (!existing) throw new CommerceAdminNotFoundError("Store product was not found.");
      if (input.active) {
        if (!input.artworkAssetId) throw new CommerceAdminConflictError("A product requires managed artwork before publication.");
        const availableVariants = await transaction.storeVariant.count({
          where: {
            storeProductId: productId,
            available: true,
            stripePriceReference: { not: "" },
            printfulVariantReference: { not: "" },
          },
        });
        if (availableVariants === 0) throw new CommerceAdminConflictError("A product requires at least one available provider-mapped variant before publication.");
      }
      return transaction.storeProduct.update({ where: { storeProductId: productId }, data: input });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isUniqueConflict(error)) throw new CommerceAdminConflictError("Product name and canonical category must be unique.");
    throw error;
  }
}

export async function saveStoreVariant(productId: string, input: z.infer<typeof saveStoreVariantSchema>, database: Database = getDatabase()) {
  try {
    return await database.$transaction(async (transaction) => {
      const [product, existing] = await Promise.all([
        transaction.storeProduct.findUnique({ where: { storeProductId: productId }, select: { storeProductId: true } }),
        transaction.storeVariant.findUnique({ where: { storeVariantId: input.storeVariantId }, select: { storeProductId: true } }),
      ]);
      if (!product) throw new CommerceAdminNotFoundError("Store product was not found.");
      if (existing && existing.storeProductId !== productId) throw new CommerceAdminConflictError("Variant identifier belongs to another product.");
      return transaction.storeVariant.upsert({
        where: { storeVariantId: input.storeVariantId },
        create: { ...input, storeProductId: productId },
        update: input,
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isUniqueConflict(error)) throw new CommerceAdminConflictError("Stripe and Printful variant references must be unique.");
    throw error;
  }
}
