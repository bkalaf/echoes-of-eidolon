import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { CommerceAdminConflictError, createStoreProduct, saveStoreVariant, updateStoreProduct } from "../../src/server/commerce-admin";

function commerceDatabase(overrides: {
  asset?: { mediaKind: "AUDIO" | "IMAGE" | "VIDEO" } | null;
  availableVariants?: number;
  existingProduct?: boolean;
  existingVariantProductId?: string | null;
} = {}) {
  const transaction = {
    managedAsset: { findUnique: vi.fn().mockResolvedValue(overrides.asset === undefined ? { mediaKind: "IMAGE" } : overrides.asset) },
    storeProduct: {
      create: vi.fn().mockResolvedValue({ storeProductId: "PRODUCT-1" }),
      findUnique: vi.fn().mockResolvedValue(overrides.existingProduct === false ? null : { storeProductId: "PRODUCT-1" }),
      update: vi.fn().mockResolvedValue({ storeProductId: "PRODUCT-1" }),
    },
    storeVariant: {
      count: vi.fn().mockResolvedValue(overrides.availableVariants ?? 1),
      findUnique: vi.fn().mockResolvedValue(overrides.existingVariantProductId ? { storeProductId: overrides.existingVariantProductId } : null),
      upsert: vi.fn().mockResolvedValue({ storeVariantId: "VARIANT-1" }),
    },
  };
  const database = {
    $transaction: vi.fn(async (work: (value: typeof transaction) => Promise<unknown>) => work(transaction)),
  } as unknown as PrismaClient;
  return { database, transaction };
}

describe("Store product authoring", () => {
  it("creates only an unpublished product from explicit canonical fields", async () => {
    const { database, transaction } = commerceDatabase();
    await createStoreProduct({ artworkAssetId: "ASSET-1", name: "Owner item", productType: "MUG", storeProductId: "PRODUCT-1" }, database);
    expect(transaction.managedAsset.findUnique).toHaveBeenCalledWith({ where: { managedAssetId: "ASSET-1" }, select: { mediaKind: true } });
    expect(transaction.storeProduct.create).toHaveBeenCalledWith({ data: { active: false, artworkAssetId: "ASSET-1", name: "Owner item", productType: "MUG", storeProductId: "PRODUCT-1" } });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects non-image managed artwork", async () => {
    const { database, transaction } = commerceDatabase({ asset: { mediaKind: "AUDIO" } });
    await expect(createStoreProduct({ artworkAssetId: "ASSET-1", name: "Owner item", productType: "MUG", storeProductId: "PRODUCT-1" }, database)).rejects.toThrow(/IMAGE managed asset/);
    expect(transaction.storeProduct.create).not.toHaveBeenCalled();
  });

  it("refuses publication until an artwork and available provider-mapped variant exist", async () => {
    const { database, transaction } = commerceDatabase({ availableVariants: 0 });
    await expect(updateStoreProduct("PRODUCT-1", { active: true, artworkAssetId: "ASSET-1", name: "Owner item", productType: "MUG" }, database)).rejects.toThrow(CommerceAdminConflictError);
    expect(transaction.storeProduct.update).not.toHaveBeenCalled();
  });

  it("upserts exact variant configuration without moving an identifier between products", async () => {
    const input = { available: true, color: "Blue", priceCents: 2400, printfulVariantReference: "PF-1", size: "11 oz", storeVariantId: "VARIANT-1", stripePriceReference: "price_1" };
    const { database, transaction } = commerceDatabase();
    await saveStoreVariant("PRODUCT-1", input, database);
    expect(transaction.storeVariant.upsert).toHaveBeenCalledWith({ where: { storeVariantId: "VARIANT-1" }, create: { ...input, storeProductId: "PRODUCT-1" }, update: input });

    const other = commerceDatabase({ existingVariantProductId: "PRODUCT-2" });
    await expect(saveStoreVariant("PRODUCT-1", input, other.database)).rejects.toThrow(/another product/);
    expect(other.transaction.storeVariant.upsert).not.toHaveBeenCalled();
  });
});
