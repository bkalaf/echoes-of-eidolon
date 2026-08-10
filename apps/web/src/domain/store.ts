export const storeProducts = [
  {
    sku: "conjunction-1-mug",
    conjunction: 1,
    name: "Mug",
    priceCents: 2400,
    variant: "11 oz ceramic",
    path: "/store/products/conjunction-1-mug",
  },
  {
    sku: "conjunction-9-hoodie",
    conjunction: 9,
    name: "Hoodie",
    priceCents: 6400,
    variant: "Apparel",
    path: "/store/products/conjunction-9-hoodie",
  },
  {
    sku: "conjunction-17-poster",
    conjunction: 17,
    name: "Poster",
    priceCents: 3200,
    variant: "24 × 36 in",
    path: "/store/products/conjunction-17-poster",
  },
] as const;

export type StoreProduct = (typeof storeProducts)[number];
export type StoreSku = StoreProduct["sku"];

export interface CartLine {
  quantity: number;
  sku: StoreSku;
}

export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const cartKey = "echoes.store.cart.v1";
const validSkus = new Set<string>(storeProducts.map((product) => product.sku));

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.sku === "string" &&
    validSkus.has(line.sku) &&
    Number.isInteger(line.quantity) &&
    Number(line.quantity) >= 1 &&
    Number(line.quantity) <= 99
  );
}

export function readCart(storage: CartStorage): CartLine[] {
  try {
    const raw = storage.getItem(cartKey);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) && value.every(isCartLine) ? value : [];
  } catch {
    return [];
  }
}

export function writeCart(storage: CartStorage, lines: CartLine[]): void {
  storage.setItem(cartKey, JSON.stringify(lines));
}

export function addCartLine(lines: CartLine[], sku: StoreSku, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Quantity must be an integer from 1 through 99.");
  }
  const existing = lines.find((line) => line.sku === sku);
  if (!existing) return [...lines, { sku, quantity }];
  const nextQuantity = existing.quantity + quantity;
  if (nextQuantity > 99) throw new Error("Cart quantity cannot exceed 99.");
  return lines.map((line) => line.sku === sku ? { ...line, quantity: nextQuantity } : line);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((total, line) => {
    const product = storeProducts.find((candidate) => candidate.sku === line.sku);
    return total + (product?.priceCents ?? 0) * line.quantity;
  }, 0);
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
