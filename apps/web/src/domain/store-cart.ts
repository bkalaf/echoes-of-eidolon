export interface StoreCartLine {
  quantity: number;
  storeVariantId: string;
}

export const storeCartStorageKey = "echoes.store.cart.v1";

export function normalizeStoreCart(value: unknown): StoreCartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const storeVariantId = "storeVariantId" in candidate && typeof candidate.storeVariantId === "string" ? candidate.storeVariantId.trim() : "";
    const quantity = "quantity" in candidate && Number.isInteger(candidate.quantity) ? Number(candidate.quantity) : 0;
    if (!storeVariantId || quantity < 1 || quantity > 20) continue;
    quantities.set(storeVariantId, Math.min(20, (quantities.get(storeVariantId) ?? 0) + quantity));
  }
  return [...quantities.entries()].slice(0, 50).map(([storeVariantId, quantity]) => ({ quantity, storeVariantId }));
}

export function addStoreCartLine(lines: readonly StoreCartLine[], storeVariantId: string, quantity = 1): StoreCartLine[] {
  return normalizeStoreCart([...lines, { quantity, storeVariantId }]);
}

export function updateStoreCartLine(lines: readonly StoreCartLine[], storeVariantId: string, quantity: number): StoreCartLine[] {
  if (quantity === 0) return lines.filter((line) => line.storeVariantId !== storeVariantId);
  return normalizeStoreCart(lines.map((line) => line.storeVariantId === storeVariantId ? { ...line, quantity } : line));
}
