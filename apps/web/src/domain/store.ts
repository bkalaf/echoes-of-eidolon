export const storeProductTypes = [
  { productType: "HOODIE", name: "Hoodie", categoryPath: "/store/categories/hoodies" },
  { productType: "MUG", name: "Mug", categoryPath: "/store/categories/mugs" },
  { productType: "POSTER", name: "Poster", categoryPath: "/store/categories/posters" },
] as const;

export type StoreProductType = (typeof storeProductTypes)[number]["productType"];

export const merchandiseConfigurationRequired = [
  "Stripe product and server-authoritative price",
  "Printful product and variant identifiers",
  "available size and color variants",
  "Conjunction artwork mapping",
] as const;
