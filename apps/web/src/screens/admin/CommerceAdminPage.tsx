import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { storeProductTypes } from "../../domain/store";
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
  printfulVariantReference: string;
  size: string | null;
  storeVariantId: string;
  stripeConfigured: boolean;
  stripePriceReference: string;
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
  contactEmail: string;
  createdAt: string;
  helpTickets: Array<{ categoryKey: string; channel: string; helpTicketId: string; status: string; subject: string; updatedAt: string }>;
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
  returnRequest: { helpTicketId: string; submittedAt: string } | null;
  user: { email: string; id: string } | null;
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

interface SubscriptionRow {
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  currentPeriodEndAt: string | null;
  currentPeriodStartAt: string | null;
  events: Array<{ eventType: string; occurredAt: string; providerStatus: string }>;
  membershipSubscriptionId: string;
  providerStatus: string;
  updatedAt: string;
  user: { email: string; id: string };
}

interface CommerceProjection {
  categories: CategoryRow[];
  donations: DonationRow[];
  orders: OrderRow[];
  products: ProductRow[];
  subscriptions: SubscriptionRow[];
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

async function loadCommerce(): Promise<CommerceProjection> {
  const response = await fetch("/api/admin/commerce/");
  const result = await response.json() as Partial<CommerceProjection> & { error?: string };
  if (!response.ok || !result.categories || !result.donations || !result.orders || !result.products || !result.subscriptions) {
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
  { id: "account", header: "Account / guest", cell: ({ row }) => row.original.user?.email ?? `${row.original.contactEmail} (guest)` },
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

const subscriptionColumns: DataTableColumnDef<SubscriptionRow>[] = [
  { accessorKey: "membershipSubscriptionId", header: "Subscription" },
  { id: "account", header: "Account", cell: ({ row }) => row.original.user.email },
  { accessorKey: "providerStatus", header: "Provider state" },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { id: "renewal", header: "Renewal", cell: ({ row }) => row.original.cancelAtPeriodEnd ? "Cancels at period end" : "Enabled" },
  { id: "events", header: "Persisted events", cell: ({ row }) => row.original.events.length },
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
  const queryClient = useQueryClient();
  const availableTypes = storeProductTypes.filter((type) => !products.some((product) => product.productType === type.productType));
  const [creating, setCreating] = useState(false);
  const [storeProductId, setStoreProductId] = useState("");
  const [name, setName] = useState("");
  const [productType, setProductType] = useState<StoreProductType>(availableTypes[0]?.productType ?? "POSTER");
  const [artworkAssetId, setArtworkAssetId] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true); setError(undefined); setMessage(undefined);
    const response = await fetch("/api/admin/commerce/products/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ artworkAssetId: artworkAssetId.trim() || null, name, productType, storeProductId }) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Store product could not be created."); return; }
    await queryClient.invalidateQueries({ queryKey: ["admin", "commerce"] });
    setCreating(false); setStoreProductId(""); setName(""); setArtworkAssetId(""); setMessage("Store product created as unpublished.");
  };
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>Store items</h2><p>Author exact catalog, managed artwork, prices, provider mappings, availability, and publication state. No wireframe sample is saved automatically.</p></div><button className="button button--gold" disabled={availableTypes.length === 0} onClick={() => { setCreating((value) => !value); setProductType(availableTypes[0]?.productType ?? "POSTER"); }} type="button">{creating ? "Close" : "New item"}</button></div>{products.length === 0 ? <p>No Store products are configured.</p> : <DataTable columns={productColumns} data={products} getRowId={(product) => product.storeProductId} preferenceKey="admin.commerce.products" />}</section>{creating && <section className="card"><h2>Create unpublished item</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); void create(); }}><label className="field">Product identifier<input className="input" value={storeProductId} onChange={(event) => setStoreProductId(event.target.value)} /></label><label className="field">Name<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field">Canonical category<select className="select" value={productType} onChange={(event) => setProductType(event.target.value as StoreProductType)}>{availableTypes.map((type) => <option key={type.productType} value={type.productType}>{type.name}</option>)}</select></label><label className="field">Managed artwork identifier<input className="input" value={artworkAssetId} onChange={(event) => setArtworkAssetId(event.target.value)} /></label><button className="button button--gold" disabled={busy || !storeProductId.trim() || !name.trim()} type="submit">{busy ? "Creating…" : "Create item"}</button></form></section>}{message && <p className="notice notice--good" role="status">{message}</p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</div>;
}

function ProductDetail({ pathname, products }: { pathname: string; products: ProductRow[] }) {
  const encodedId = pathname.match(/^\/admin\/store\/items\/([^/]+)$/)?.[1];
  let productId: string | undefined;
  try { productId = encodedId ? decodeURIComponent(encodedId) : undefined; } catch { productId = undefined; }
  const product = products.find((candidate) => candidate.storeProductId === productId);
  if (!productId) return <p className="notice notice--bad" role="alert">A concrete Store product identifier is required.</p>;
  if (!product) return <p className="notice notice--bad" role="alert">Store product {productId} was not found.</p>;
  return <ProductEditor product={product} />;
}

function ProductEditor({ product }: { product: ProductRow }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(product.name);
  const [productType, setProductType] = useState<StoreProductType>(product.productType);
  const [artworkAssetId, setArtworkAssetId] = useState(product.artworkAssetId ?? "");
  const [active, setActive] = useState(product.active);
  const [storeVariantId, setStoreVariantId] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [stripePriceReference, setStripePriceReference] = useState("");
  const [printfulVariantReference, setPrintfulVariantReference] = useState("");
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin", "commerce"] });
  const perform = async (request: () => Promise<Response>, success: string) => {
    setBusy(true); setMessage(undefined); setError(undefined);
    const response = await request();
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Commerce configuration could not be saved."); return; }
    await refresh(); setMessage(success);
  };
  const editVariant = (variant: ProductVariant) => {
    setStoreVariantId(variant.storeVariantId); setSize(variant.size ?? ""); setColor(variant.color ?? ""); setPriceCents(variant.priceCents); setStripePriceReference(variant.stripePriceReference); setPrintfulVariantReference(variant.printfulVariantReference); setAvailable(variant.available);
  };
  const clearVariant = () => { setStoreVariantId(""); setSize(""); setColor(""); setPriceCents(0); setStripePriceReference(""); setPrintfulVariantReference(""); setAvailable(false); };
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>{product.name}</h2><p>{product.storeProductId}</p></div><a className="button" href="/admin/store/items">All items</a></div><form className="form-grid" onSubmit={(event) => { event.preventDefault(); void perform(() => fetch(`/api/admin/commerce/products/${encodeURIComponent(product.storeProductId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active, artworkAssetId: artworkAssetId.trim() || null, name, productType }) }), "Store product saved."); }}><label className="field">Name<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field">Canonical category<select className="select" value={productType} onChange={(event) => setProductType(event.target.value as StoreProductType)}>{storeProductTypes.map((type) => <option key={type.productType} value={type.productType}>{type.name}</option>)}</select></label><label className="field span-2">Managed artwork identifier<input className="input" value={artworkAssetId} onChange={(event) => setArtworkAssetId(event.target.value)} /></label><label className="check"><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Published</label><button className="button button--gold" disabled={busy || !name.trim()} type="submit">Save item</button></form></section><section className="card"><div className="action-row action-row--between"><div><h2>Commerce variants</h2><p>Provider references are exact administrator-authored configuration. They are never inferred from labels.</p></div><button className="button" onClick={clearVariant} type="button">New variant</button></div>{product.variants.length === 0 ? <p>No variants are stored.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Variant</th><th>Size</th><th>Color</th><th>Price</th><th>Stripe</th><th>Printful</th><th>Available</th><th></th></tr></thead><tbody>{product.variants.map((variant) => <tr key={variant.storeVariantId}><td>{variant.storeVariantId}</td><td>{variant.size ?? "Not set"}</td><td>{variant.color ?? "Not set"}</td><td>{formatMoney(variant.priceCents)}</td><td>{variant.stripeConfigured ? "Configured" : "Missing"}</td><td>{variant.printfulConfigured ? "Configured" : "Missing"}</td><td>{variant.available ? "Yes" : "No"}</td><td><button className="button" onClick={() => editVariant(variant)} type="button">Edit</button></td></tr>)}</tbody></table></div>}<form className="form-grid" onSubmit={(event) => { event.preventDefault(); void perform(() => fetch(`/api/admin/commerce/products/${encodeURIComponent(product.storeProductId)}/variants`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ available, color: color.trim() || null, priceCents, printfulVariantReference, size: size.trim() || null, storeVariantId, stripePriceReference }) }), "Store variant saved."); }}><label className="field">Variant identifier<input className="input" disabled={product.variants.some((variant) => variant.storeVariantId === storeVariantId)} value={storeVariantId} onChange={(event) => setStoreVariantId(event.target.value)} /></label><label className="field">Price in cents<input className="input" min={1} type="number" value={priceCents || ""} onChange={(event) => setPriceCents(Number(event.target.value))} /></label><label className="field">Size<input className="input" value={size} onChange={(event) => setSize(event.target.value)} /></label><label className="field">Color<input className="input" value={color} onChange={(event) => setColor(event.target.value)} /></label><label className="field">Stripe price reference<input className="input" value={stripePriceReference} onChange={(event) => setStripePriceReference(event.target.value)} /></label><label className="field">Printful variant reference<input className="input" value={printfulVariantReference} onChange={(event) => setPrintfulVariantReference(event.target.value)} /></label><label className="check"><input checked={available} type="checkbox" onChange={(event) => setAvailable(event.target.checked)} /> Available</label><button className="button button--gold" disabled={busy || !storeVariantId.trim() || priceCents < 1 || !stripePriceReference.trim() || !printfulVariantReference.trim()} type="submit">Save variant</button></form></section>{message && <p className="notice notice--good" role="status">{message}</p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</div>;
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

function Subscriptions({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  return <section className="card"><h2>Subscription transactions</h2><p>Provider lifecycle and renewal state come from persisted signed Stripe events. Member entitlement remains a separate append-only grant projection.</p>{subscriptions.length === 0 ? <p>No subscription records are stored.</p> : <DataTable columns={subscriptionColumns} data={subscriptions} getRowId={(subscription) => subscription.membershipSubscriptionId} preferenceKey="admin.commerce.subscriptions" />}</section>;
}

function OrderManagement({ data, selected }: { data: CommerceProjection; selected: "all" | "donations" | "merchandise" | "subscriptions" }) {
  return <div className="stack"><OrderTabs selected={selected} />{selected === "subscriptions" ? <Subscriptions subscriptions={data.subscriptions} /> : selected === "donations" ? <Donations donations={data.donations} /> : selected === "merchandise" ? <MerchandiseOrders orders={data.orders} /> : <><MerchandiseOrders orders={data.orders} /><Subscriptions subscriptions={data.subscriptions} /><Donations donations={data.donations} /></>}</div>;
}

function OrderDetail({ orders, pathname }: { orders: OrderRow[]; pathname: string }) {
  const encodedId = pathname.match(/^\/admin\/orders\/([^/]+)$/)?.[1];
  let orderId: string | undefined;
  try { orderId = encodedId ? decodeURIComponent(encodedId) : undefined; } catch { orderId = undefined; }
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!orderId) return <p className="notice notice--bad" role="alert">A concrete order identifier is required.</p>;
  if (!order) return <p className="notice notice--bad" role="alert">Order {orderId} was not found.</p>;
  const total = order.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  return <div className="stack"><div className="grid-2"><section className="card"><div className="action-row action-row--between"><div><h2>Order {order.orderId}</h2><p>{order.user?.email ?? `${order.contactEmail} (guest)`}</p></div><a className="button" href="/admin/orders">All orders</a></div><dl className="detail-list"><dt>Created</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd><dt>Server line total</dt><dd>{formatMoney(total)}</dd><dt>Payment</dt><dd>{order.paymentConfirmation ? `${formatMoney(order.paymentConfirmation.amountCents)} confirmed` : "Unconfirmed"}</dd><dt>Fulfillment</dt><dd>{order.paymentConfirmation?.fulfillment ? "Printful submitted" : "Not submitted"}</dd><dt>Refunded</dt><dd>{formatMoney(order.refundedAmountCents)}</dd><dt>Return eligibility</dt><dd>{order.returnEligibility ? new Date(order.returnEligibility.eligibleAt).toLocaleString() : "Not recorded"}</dd><dt>Return request</dt><dd>{order.returnRequest ? `Submitted ${new Date(order.returnRequest.submittedAt).toLocaleString()}` : "None"}</dd></dl></section><section className="card"><h2>Persisted timeline</h2><ol><li>Order created — {new Date(order.createdAt).toLocaleString()}</li>{order.paymentConfirmation && <li>Stripe payment confirmed — {new Date(order.paymentConfirmation.confirmedAt).toLocaleString()}</li>}{order.paymentConfirmation?.fulfillment && <li>Printful submitted — {new Date(order.paymentConfirmation.fulfillment.submittedAt).toLocaleString()}</li>}{order.returnRequest && <li>Return request received — {new Date(order.returnRequest.submittedAt).toLocaleString()}</li>}{order.refunds.map((refund, index) => <li key={`${refund.refundedAt}-${index}`}>Refund recorded ({formatMoney(refund.amountCents)}) — {new Date(refund.refundedAt).toLocaleString()}</li>)}</ol></section></div><section className="card"><h2>Order support and return intake</h2>{order.helpTickets.length === 0 ? <p>No order-linked Help Tickets.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Ticket</th><th>Channel</th><th>Category</th><th>Subject</th><th>Status</th><th>Updated</th></tr></thead><tbody>{order.helpTickets.map((ticket) => <tr key={ticket.helpTicketId}><td>{ticket.helpTicketId}</td><td>{ticket.channel}</td><td>{ticket.categoryKey}</td><td>{ticket.subject}</td><td>{ticket.status}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}<p className="muted">Intake is visible for review; it does not authorize or execute a Stripe refund or Printful change.</p></section><section className="card"><h2>Order lines</h2><div className="table-scroll"><table className="simple-table"><thead><tr><th>Item</th><th>Variant</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.orderLineId}><td>{line.storeVariant.storeProduct.name}</td><td>{[line.storeVariant.size, line.storeVariant.color].filter(Boolean).join(" · ") || line.storeVariant.storeVariantId}</td><td>{line.quantity}</td><td>{formatMoney(line.unitPriceCents)}</td><td>{formatMoney(line.quantity * line.unitPriceCents)}</td></tr>)}</tbody></table></div></section><section className="card"><h2>Administrative actions</h2><div className="action-row"><button className="button" disabled>Receipt delivery unavailable</button><button className="button" disabled>Refund requires signed Stripe operation</button></div><p className="notice notice--warn">No receipt delivery or refund mutation owner exists in the supplied implementation. Persisted webhook refunds remain visible above.</p></section></div>;
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
