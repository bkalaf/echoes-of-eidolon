import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface ProductRow {
  active: boolean;
  artworkAssetId: string | null;
  name: string;
  storeProductId: string;
  variants: Array<{ available: boolean; color: string | null; priceCents: number; printfulConfigured: boolean; size: string | null; storeVariantId: string; stripeConfigured: boolean }>;
}

interface OrderRow {
  createdAt: string;
  lines: Array<{ quantity: number; storeVariant: { color: string | null; size: string | null; storeProduct: { name: string }; storeVariantId: string }; unitPriceCents: number }>;
  orderId: string;
  paymentConfirmation: { amountCents: number; confirmedAt: string; fulfillment: { submittedAt: string } | null } | null;
  refundedAmountCents: number;
  returnEligibility: { eligibleAt: string } | null;
  user: { email: string; id: string };
}

const productColumns: DataTableColumnDef<ProductRow>[] = [
  { accessorKey: "storeProductId", header: "Product" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "active", header: "Active", cell: ({ row }) => row.original.active ? "Yes" : "No" },
  { accessorKey: "artworkAssetId", header: "Artwork", cell: ({ row }) => row.original.artworkAssetId ?? "Unconfigured" },
  { id: "variants", header: "Variants", cell: ({ row }) => row.original.variants.length },
  { id: "available", header: "Available variants", cell: ({ row }) => row.original.variants.filter((variant) => variant.available).length },
];

const orderColumns: DataTableColumnDef<OrderRow>[] = [
  { accessorKey: "orderId", header: "Order" },
  { id: "account", header: "Account", cell: ({ row }) => row.original.user.email },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { id: "payment", header: "Payment", cell: ({ row }) => row.original.paymentConfirmation ? "Stripe confirmed" : "Unconfirmed" },
  { id: "fulfillment", header: "Fulfillment", cell: ({ row }) => row.original.paymentConfirmation?.fulfillment ? "Printful submitted" : "Not submitted" },
  { accessorKey: "refundedAmountCents", header: "Refunded cents" },
  { id: "returns", header: "Return", cell: ({ row }) => row.original.returnEligibility ? "Explicitly eligible" : "Not eligible" },
];

async function loadCommerce() {
  const response = await fetch("/api/admin/commerce/");
  const result = await response.json() as { error?: string; orders?: OrderRow[]; products?: ProductRow[] };
  if (!response.ok || !result.orders || !result.products) throw new Error(result.error ?? "Commerce records could not be loaded.");
  return { orders: result.orders, products: result.products };
}

export function CommerceAdminPage({ screen }: { screen: PageManifestEntry }) {
  const commerce = useQuery({ queryKey: ["admin", "commerce"], queryFn: loadCommerce, retry: false });
  if (commerce.isPending) return <p className="notice">Loading commerce records…</p>;
  if (commerce.isError) return <p className="notice notice--bad" role="alert">{commerce.error.message}</p>;
  const orders = screen.path?.startsWith("/admin/orders");
  if (orders) return <section className="card"><h2>Orders</h2><p>Payment is confirmed only by a persisted signed Stripe webhook; Printful submission is shown only when linked to that confirmation.</p>{commerce.data.orders.length === 0 ? <p>No merchandise orders are stored.</p> : <DataTable columns={orderColumns} data={commerce.data.orders} getRowId={(order) => order.orderId} preferenceKey="admin.commerce.orders" />}</section>;
  return <div className="stack"><section className="card"><h2>Configured merchandise</h2><p>Prices, variants, availability, and artwork are server-owned configuration. Missing configuration remains unavailable.</p>{commerce.data.products.length === 0 ? <p>No Store products are configured.</p> : <DataTable columns={productColumns} data={commerce.data.products} getRowId={(product) => product.storeProductId} preferenceKey="admin.commerce.products" />}</section>{screen.screenId === "ADM011" && <p className="notice notice--warn">No Store Category persistence contract exists; categories are not inferred from product names.</p>}</div>;
}
