import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { StoreProductType, DonationCheckoutStatus } from "../../generated/prisma/enums";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface CategoryRow {
  activeItems: number;
  categoryPath: string;
  items: number;
  name: string;
  productType: StoreProductType;
}

interface ProductVariant {
  available: boolean;
  color: string | null;
  priceCents: number;
  printfulConfigured: boolean;
  size: string | null;
  storeVariantId: string;
  stripeConfigured: boolean;
}

interface ProductRow {
  active: boolean;
  artworkAssetId: string | null;
  name: string;
  productType: StoreProductType;
  storeProductId: string;
  variants: ProductVariant[];
}

interface OrderRow {
  createdAt: string;
  lines: Array<{
    orderLineId: string;
    quantity: number;
    storeVariant: { color: string | null; size: string | null; storeProduct: { name: string }; storeVariantId: string };
    unitPriceCents: number;
  }>;
  orderId: string;
  paymentConfirmation: { amountCents: number; confirmedAt: string; fulfillment: { submittedAt: string } | null } | null;
  refundedAmountCents: number;
  refunds: Array<{ amountCents: number; refundedAt: string }>;
  returnEligibility: { eligibleAt: string } | null;
  user: { email: string; id: string };
}

interface DonationRow {
  amountCents: number;
  confirmedAt: string | null;
  createdAt: string;
  donationCheckoutId: string;
  monthsGranted: number;
  status: DonationCheckoutStatus;
  stripeConfigured: boolean;
  user: { email: string; id: string };
}

interface CommerceProjection {
  categories: CategoryRow[];
  donations: DonationRow[];
  orders: OrderRow[];
  products: ProductRow[];
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

async function loadCommerce(): Promise<CommerceProjection> {
  const response = await fetch("/api/admin/commerce/");
  const result = await response.json() as Partial<CommerceProjection> & { error?: string };
  if (!response.ok || !result.categories || !result.donations || !result.orders || !result.products) {
    throw new Error(result.error ?? "Commerce records could not be loaded.");
  }
  return result as CommerceProjection;
}

function useCommerce() {
  return useQuery({ queryKey: ["admin", "commerce"], queryFn: loadCommerce, retry: false });
}

function CommerceQueryBoundary({ children }: { children: (data: CommerceProjection) => ReactNode }) {
  const commerce = useCommerce();
  if (commerce.isPending) return <p className="notice">Loading commerce records…</p>;
  if (commerce.isError) return <p className="notice notice--bad" role="alert">{commerce.error.message}</p>;
  return children(commerce.data);
}

const productColumns: DataTableColumnDef<ProductRow>[] = [
  { accessorKey: "storeProductId", header: "Product", cell: ({ row }) => <a href={`/admin/store/items/${encodeURIComponent(row.original.storeProductId)}`}>{row.original.storeProductId}</a> },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "productType", header: "Category" },
  { accessorKey: "active", header: "Published", cell: ({ row }) => row.original.active ? "Yes" : "No" },
  { accessorKey: "artworkAssetId", header: "Artwork", cell: ({ row }) => row.original.artworkAssetId ?? "Unconfigured" },
  { id: "variants", header: "Variants", cell: ({ row }) => row.original.variants.length },
  { id: "available", header: "Available", cell: ({ row }) => row.original.variants.filter((variant) => variant.available).length },
];

const categoryColumns: DataTableColumnDef<CategoryRow>[] = [
  { accessorKey: "name", header: "Category" },
  { accessorKey: "productType", header: "Canonical type" },
  { accessorKey: "items", header: "Configured items" },
  { accessorKey: "activeItems", header: "Published items" },
  { accessorKey: "categoryPath", header: "Public route", cell: ({ row }) => <a href={row.original.categoryPath}>{row.original.categoryPath}</a> },
];

const orderColumns: DataTableColumnDef<OrderRow>[] = [
  { accessorKey: "orderId", header: "Order", cell: ({ row }) => <a href={`/admin/orders/${encodeURIComponent(row.original.orderId)}`}>{row.original.orderId}</a> },
  { id: "account", header: "Account", cell: ({ row }) => row.original.user.email },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { id: "amount", header: "Amount", cell: ({ row }) => row.original.paymentConfirmation ? formatMoney(row.original.paymentConfirmation.amountCents) : "Unconfirmed" },
  { id: "payment", header: "Payment", cell: ({ row }) => row.original.paymentConfirmation ? "Stripe confirmed" : "Unconfirmed" },
  { id: "fulfillment", header: "Fulfillment", cell: ({ row }) => row.original.paymentConfirmation?.fulfillment ? "Printful submitted" : "Not submitted" },
  { accessorKey: "refundedAmountCents", header: "Refunded", cell: ({ row }) => formatMoney(row.original.refundedAmountCents) },
];

const donationColumns: DataTableColumnDef<DonationRow>[] = [
  { accessorKey: "donationCheckoutId", header: "Donation" },
  { id: "account", header: "Account", cell: ({ row }) => row.original.user.email },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { accessorKey: "amountCents", header: "Amount", cell: ({ row }) => formatMoney(row.original.amountCents) },
  { accessorKey: "monthsGranted", header: "Membership months" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "confirmedAt", header: "Confirmed", cell: ({ row }) => row.original.confirmedAt ? new Date(row.original.confirmedAt).toLocaleString() : "Not confirmed" },
];

function StoreOverview({ data }: { data: CommerceProjection }) {
  const activeProducts = data.products.filter((product) => product.active).length;
  const configuredVariants = data.products.flatMap((product) => product.variants).filter((variant) => variant.stripeConfigured && variant.printfulConfigured).length;
  const unconfirmedOrders = data.orders.filter((order) => !order.paymentConfirmation).length;
  return <div className="stack"><section className="metric-grid"><article className="metric-card"><span>Published items</span><strong>{activeProducts}</strong><small>Persisted active products</small></article><article className="metric-card"><span>Provider-mapped variants</span><strong>{configuredVariants}</strong><small>Both stored references present</small></article><article className="metric-card"><span>Unconfirmed orders</span><strong>{unconfirmedOrders}</strong><small>No signed payment confirmation</small></article><article className="metric-card"><span>Canonical categories</span><strong>{data.categories.length}</strong><small>Finite StoreProductType values</small></article></section><section className="card"><div className="action-row action-row--between"><div><h2>Configured merchandise</h2><p>The initial catalog is projected only from persisted product, artwork, variant, and provider configuration.</p></div><a className="button" href="/admin/store/categories">Categories</a></div>{data.products.length === 0 ? <p>No Store products are configured.</p> : <DataTable columns={productColumns} data={data.products} getRowId={(product) => product.storeProductId} preferenceKey="admin.commerce.overview" />}</section><p className="notice notice--warn">Production merchandise activation remains unavailable until the exact artwork mapping, real provider variants, credentials, and shipping-country allowlist are configured.</p></div>;
}

function Categories({ categories }: { categories: CategoryRow[] }) {
  return <section className="card"><h2>Canonical Store categories</h2><p>Categories are the finite `StoreProductType` domain values. They are not free-form records, so this screen does not create competing category slugs or taxonomy rows.</p><DataTable columns={categoryColumns} data={categories} getRowId={(category) => category.productType} preferenceKey="admin.commerce.categories" /></section>;
}

function ProductList({ products }: { products: ProductRow[] }) {
  return <section className="card"><h2>Store items</h2><p>Prices, variants, availability, and artwork remain server-owned configuration. Missing values are not replaced with wireframe samples.</p>{products.length === 0 ? <p>No Store products are configured.</p> : <DataTable columns={productColumns} data={products} getRowId={(product) => product.storeProductId} preferenceKey="admin.commerce.products" />}</section>;
}

function ProductDetail({ pathname, products }: { pathname: string; products: ProductRow[] }) {
  const encodedId = pathname.match(/^\/admin\/store\/items\/([^/]+)$/)?.[1];
  let productId: string | undefined;
  try { productId = encodedId ? decodeURIComponent(encodedId) : undefined; } catch { productId = undefined; }
  const product = products.find((candidate) => candidate.storeProductId === productId);
  if (!productId) return <p className="notice notice--bad" role="alert">A concrete Store product identifier is required.</p>;
  if (!product) return <p className="notice notice--bad" role="alert">Store product {productId} was not found.</p>;
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>{product.name}</h2><p>{product.storeProductId}</p></div><a className="button" href="/admin/store/items">All items</a></div><dl className="detail-list"><dt>Canonical category</dt><dd>{product.productType}</dd><dt>Published</dt><dd>{product.active ? "Yes" : "No"}</dd><dt>Artwork asset</dt><dd>{product.artworkAssetId ?? "Unconfigured"}</dd></dl></section><section className="card"><h2>Commerce configuration</h2>{product.variants.length === 0 ? <p>No variants are stored.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Variant</th><th>Size</th><th>Color</th><th>Price</th><th>Stripe</th><th>Printful</th><th>Available</th></tr></thead><tbody>{product.variants.map((variant) => <tr key={variant.storeVariantId}><td>{variant.storeVariantId}</td><td>{variant.size ?? "Not set"}</td><td>{variant.color ?? "Not set"}</td><td>{formatMoney(variant.priceCents)}</td><td>{variant.stripeConfigured ? "Configured" : "Missing"}</td><td>{variant.printfulConfigured ? "Configured" : "Missing"}</td><td>{variant.available ? "Yes" : "No"}</td></tr>)}</tbody></table></div>}<p className="notice notice--warn">Editing external mappings, prices, artwork, or publication state is unavailable until the owner-deferred merchandise configuration is supplied. No sample wireframe value can be saved here.</p></section></div>;
}

function OrderTabs({ selected }: { selected: "all" | "donations" | "merchandise" | "subscriptions" }) {
  const tabs = [
    ["All persisted", "all", "/admin/orders?state=ADM014"],
    ["Merchandise", "merchandise", "/admin/orders?state=ADM015"],
    ["Subscriptions", "subscriptions", "/admin/orders?state=ADM016"],
    ["Donations", "donations", "/admin/orders?state=ADM017"],
  ] as const;
  return <nav className="action-row" aria-label="Order record type">{tabs.map(([label, key, href]) => <a aria-current={selected === key ? "page" : undefined} className={`button ${selected === key ? "button--gold" : ""}`} href={href} key={key}>{label}</a>)}</nav>;
}

function MerchandiseOrders({ orders }: { orders: OrderRow[] }) {
  return <section className="card"><h2>Merchandise orders</h2><p>Payment appears only after a persisted signed Stripe webhook; Printful status appears only after its separate persisted submission.</p>{orders.length === 0 ? <p>No merchandise orders are stored.</p> : <DataTable columns={orderColumns} data={orders} getRowId={(order) => order.orderId} preferenceKey="admin.commerce.orders" />}</section>;
}

function Donations({ donations }: { donations: DonationRow[] }) {
  return <section className="card"><h2>Donation transactions</h2><p>Donation status, amount, and granted membership months are projected from `DonationCheckout`; provider results are never inferred.</p>{donations.length === 0 ? <p>No donation checkouts are stored.</p> : <DataTable columns={donationColumns} data={donations} getRowId={(donation) => donation.donationCheckoutId} preferenceKey="admin.commerce.donations" />}</section>;
}

function OrderManagement({ data, selected }: { data: CommerceProjection; selected: "all" | "donations" | "merchandise" | "subscriptions" }) {
  return <div className="stack"><OrderTabs selected={selected} />{selected === "subscriptions" ? <section className="card"><h2>Subscription transactions unavailable</h2><p>The repository has membership entitlement grants, but no authoritative subscription checkout or subscription-order persistence. Entitlements are not relabeled as purchases.</p></section> : selected === "donations" ? <Donations donations={data.donations} /> : selected === "merchandise" ? <MerchandiseOrders orders={data.orders} /> : <><MerchandiseOrders orders={data.orders} /><Donations donations={data.donations} /></>}</div>;
}

function OrderDetail({ orders, pathname }: { orders: OrderRow[]; pathname: string }) {
  const encodedId = pathname.match(/^\/admin\/orders\/([^/]+)$/)?.[1];
  let orderId: string | undefined;
  try { orderId = encodedId ? decodeURIComponent(encodedId) : undefined; } catch { orderId = undefined; }
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!orderId) return <p className="notice notice--bad" role="alert">A concrete order identifier is required.</p>;
  if (!order) return <p className="notice notice--bad" role="alert">Order {orderId} was not found.</p>;
  const total = order.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  return <div className="stack"><div className="grid-2"><section className="card"><div className="action-row action-row--between"><div><h2>Order {order.orderId}</h2><p>{order.user.email}</p></div><a className="button" href="/admin/orders">All orders</a></div><dl className="detail-list"><dt>Created</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd><dt>Server line total</dt><dd>{formatMoney(total)}</dd><dt>Payment</dt><dd>{order.paymentConfirmation ? `${formatMoney(order.paymentConfirmation.amountCents)} confirmed` : "Unconfirmed"}</dd><dt>Fulfillment</dt><dd>{order.paymentConfirmation?.fulfillment ? "Printful submitted" : "Not submitted"}</dd><dt>Refunded</dt><dd>{formatMoney(order.refundedAmountCents)}</dd><dt>Return eligibility</dt><dd>{order.returnEligibility ? new Date(order.returnEligibility.eligibleAt).toLocaleString() : "Not recorded"}</dd></dl></section><section className="card"><h2>Persisted timeline</h2><ol><li>Order created — {new Date(order.createdAt).toLocaleString()}</li>{order.paymentConfirmation && <li>Stripe payment confirmed — {new Date(order.paymentConfirmation.confirmedAt).toLocaleString()}</li>}{order.paymentConfirmation?.fulfillment && <li>Printful submitted — {new Date(order.paymentConfirmation.fulfillment.submittedAt).toLocaleString()}</li>}{order.refunds.map((refund, index) => <li key={`${refund.refundedAt}-${index}`}>Refund recorded ({formatMoney(refund.amountCents)}) — {new Date(refund.refundedAt).toLocaleString()}</li>)}</ol></section></div><section className="card"><h2>Order lines</h2><div className="table-scroll"><table className="simple-table"><thead><tr><th>Item</th><th>Variant</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.orderLineId}><td>{line.storeVariant.storeProduct.name}</td><td>{[line.storeVariant.size, line.storeVariant.color].filter(Boolean).join(" · ") || line.storeVariant.storeVariantId}</td><td>{line.quantity}</td><td>{formatMoney(line.unitPriceCents)}</td><td>{formatMoney(line.quantity * line.unitPriceCents)}</td></tr>)}</tbody></table></div></section><section className="card"><h2>Administrative actions</h2><div className="action-row"><button className="button" disabled>Receipt delivery unavailable</button><button className="button" disabled>Refund requires signed Stripe operation</button></div><p className="notice notice--warn">No receipt delivery or refund mutation owner exists in the supplied implementation. Persisted webhook refunds remain visible above.</p></section></div>;
}

function UnknownCommerce() {
  return <section className="card"><h2>Commerce workflow unavailable</h2><p>No other commerce workflow or records are substituted for this screen.</p></section>;
}

export function CommerceAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  if (!["ADM010", "ADM011", "ADM012", "ADM013", "ADM014", "ADM015", "ADM016", "ADM017", "ADM018"].includes(screen.screenId)) return <UnknownCommerce />;
  return <CommerceQueryBoundary>{(data) => {
    if (screen.screenId === "ADM010") return <StoreOverview data={data} />;
    if (screen.screenId === "ADM011") return <Categories categories={data.categories} />;
    if (screen.screenId === "ADM012") return <ProductList products={data.products} />;
    if (screen.screenId === "ADM013") return <ProductDetail pathname={pathname} products={data.products} />;
    if (screen.screenId === "ADM015") return <OrderManagement data={data} selected="merchandise" />;
    if (screen.screenId === "ADM016") return <OrderManagement data={data} selected="subscriptions" />;
    if (screen.screenId === "ADM017") return <OrderManagement data={data} selected="donations" />;
    if (screen.screenId === "ADM018") return <OrderDetail orders={data.orders} pathname={pathname} />;
    return <OrderManagement data={data} selected="all" />;
  }}</CommerceQueryBoundary>;
}
