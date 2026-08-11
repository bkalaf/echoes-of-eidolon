import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { StoreShell } from "../../components/shells/Shells";
import { merchandiseConfigurationRequired, storeProductTypes } from "../../domain/store";
import { addStoreCartLine, normalizeStoreCart, storeCartStorageKey, updateStoreCartLine, type StoreCartLine } from "../../domain/store-cart";
import type { PageManifestEntry } from "../../lib/page-manifest";

function StoreHead({ title, path, description }: { title: string; path: string; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">STORE · {path.toUpperCase()}</p><h1>{title}</h1><p>{description}</p></header>;
}

function ConfigurationNotice() {
  return <p className="notice notice--warn">Merchandise purchase is unavailable until {merchandiseConfigurationRequired.join(", ")}. No product mapping, price, variant, or availability is fabricated.</p>;
}

const categoryProductType = {
  STORE02: "POSTER",
  STORE03: "MUG",
  STORE04: "HOODIE",
} as const;

interface CatalogProduct {
  name: string;
  productType: "POSTER" | "MUG" | "HOODIE";
  storeProductId: string;
  variants: Array<{ color: string | null; priceCents: number; size: string | null; storeVariantId: string }>;
}

async function loadCatalog(): Promise<CatalogProduct[]> {
  const response = await fetch("/api/store/catalog");
  if (!response.ok) throw new Error("The configured Store catalog could not be loaded.");
  return (await response.json() as { products: CatalogProduct[] }).products;
}

function useStoreCart() {
  const [lines, setLines] = useState<StoreCartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try { return normalizeStoreCart(JSON.parse(window.localStorage.getItem(storeCartStorageKey) ?? "[]")); }
    catch { return []; }
  });
  useEffect(() => { window.localStorage.setItem(storeCartStorageKey, JSON.stringify(lines)); }, [lines]);
  return { lines, setLines };
}

function Catalog({ screen }: { screen: PageManifestEntry }) {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const productType = categoryProductType[screen.screenId as keyof typeof categoryProductType];
  const configured = catalog.data?.filter((product) => !productType || product.productType === productType) ?? [];
  const expected = screen.screenId === "STORE01" ? storeProductTypes : storeProductTypes.filter((product) => product.productType === productType);
  return <><StoreHead title={screen.title} path={screen.path ?? "/store"} description="The server-configured merchandise catalog." />{catalog.isPending ? <p className="notice">Loading configured merchandise…</p> : catalog.isError ? <p className="notice notice--bad">{catalog.error.message}</p> : configured.length === 0 ? <><div className="product-grid">{expected.map((product) => <article className="product-card" key={product.productType}><div className="product-art" aria-hidden="true"><span>—</span></div><h2>{product.name}</h2><p>Not configured for sale</p><a className="button" href={product.categoryPath}>View category</a></article>)}</div><ConfigurationNotice /></> : <div className="product-grid">{configured.map((product) => <article className="product-card" key={product.storeProductId}><div className="product-art" aria-hidden="true"><span>—</span></div><h2>{product.name}</h2><p>{product.variants.length} available variant(s) · from ${(Math.min(...product.variants.map((variant) => variant.priceCents)) / 100).toFixed(2)}</p><a className="button" href={`/store/products/${encodeURIComponent(product.storeProductId)}`}>View product</a></article>)}</div>}</>;
}

function ProductDetail({ pathname }: { pathname?: string }) {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const cart = useStoreCart();
  const [message, setMessage] = useState("");
  const productId = pathname?.split("/").at(-1);
  const product = catalog.data?.find((candidate) => candidate.storeProductId === productId);
  return <><StoreHead title="Product Detail" path="/store/products/:slug" description="Configured merchandise product detail." />{catalog.isPending ? <p className="notice">Loading product…</p> : !product ? <section className="card"><h2>Product unavailable</h2><p>No configured product matches this route. Raw Stripe and Printful identifiers are never exposed.</p></section> : <section className="card"><h2>{product.name}</h2><div className="stack">{product.variants.map((variant) => <article className="action-row action-row--between" key={variant.storeVariantId}><span>{variant.size ?? "Standard"} · {variant.color ?? "Standard"} · ${(variant.priceCents / 100).toFixed(2)}</span><button className="button" onClick={() => { cart.setLines((lines) => addStoreCartLine(lines, variant.storeVariantId)); setMessage(`${product.name} added to cart.`); }} type="button">Add to cart</button></article>)}</div><div className="action-row"><a className="button button--gold" href="/store/cart">View cart ({cart.lines.reduce((sum, line) => sum + line.quantity, 0)})</a></div>{message && <p className="notice notice--good" role="status">{message}</p>}</section>}</>;
}

function Cart() {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const cart = useStoreCart();
  const variants = new Map(catalog.data?.flatMap((product) => product.variants.map((variant) => [variant.storeVariantId, { ...variant, productName: product.name }] as const)) ?? []);
  const totalCents = cart.lines.reduce((sum, line) => sum + (variants.get(line.storeVariantId)?.priceCents ?? 0) * line.quantity, 0);
  return <><StoreHead title="Cart" path="/store/cart" description="Browser-local merchandise selections resolved against the server catalog." /><section className="card"><h2>Your cart</h2><p>The cart stores only configured variant identifiers and quantities. Prices and availability are resolved from the server catalog again at checkout.</p>{catalog.isPending ? <p className="notice">Loading configured merchandise…</p> : cart.lines.length === 0 ? <p>Your cart is empty.</p> : <div className="stack">{cart.lines.map((line) => { const variant = variants.get(line.storeVariantId); return <article className="action-row action-row--between" key={line.storeVariantId}><div><strong>{variant?.productName ?? "Unavailable variant"}</strong><br /><span>{variant ? `${variant.size ?? "Standard"} · ${variant.color ?? "Standard"} · $${(variant.priceCents / 100).toFixed(2)}` : line.storeVariantId}</span></div><label className="field">Quantity<input aria-label={`Quantity for ${variant?.productName ?? line.storeVariantId}`} className="input" max={20} min={0} type="number" value={line.quantity} onChange={(event) => cart.setLines((lines) => updateStoreCartLine(lines, line.storeVariantId, Number(event.target.value)))} /></label><button className="button" onClick={() => cart.setLines((lines) => updateStoreCartLine(lines, line.storeVariantId, 0))} type="button">Remove</button></article>; })}<p><strong>Catalog total: ${(totalCents / 100).toFixed(2)}</strong></p></div>}<div className="action-row"><a className="button" href="/auth/sign-in?returnTo=%2Fstore%2Fcart">Sign in</a><a aria-disabled={cart.lines.length === 0 || cart.lines.some((line) => !variants.has(line.storeVariantId))} className="button button--gold" href={cart.lines.length > 0 && cart.lines.every((line) => variants.has(line.storeVariantId)) ? "/store/checkout" : undefined}>Open checkout</a></div><p className="muted">Guest checkout is not allowed; the checkout endpoint verifies player access and server-owned variants.</p></section></>;
}

function Checkout() {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const cart = useStoreCart();
  const variants = catalog.data?.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name }))) ?? [];
  const [message, setMessage] = useState("");
  const catalogVariantIds = new Set(variants.map((variant) => variant.storeVariantId));
  const ready = cart.lines.length > 0 && cart.lines.every((line) => catalogVariantIds.has(line.storeVariantId));
  return <><StoreHead title="Checkout" path="/store/checkout" description="Authenticated Stripe checkout using server-owned variants and prices." /><section className="card"><h2>Merchandise checkout</h2><p>Contact email comes from the authenticated account. Stripe securely collects the delivery address using the owner-approved server shipping-country allowlist.</p>{cart.lines.length === 0 ? <p>Your cart is empty.</p> : <ul>{cart.lines.map((line) => { const variant = variants.find((candidate) => candidate.storeVariantId === line.storeVariantId); return <li key={line.storeVariantId}>{variant ? `${variant.productName} · ${variant.size ?? "Standard"} · ${variant.color ?? "Standard"}` : "Unavailable variant"} · quantity {line.quantity}</li>; })}</ul>}<div className="action-row"><a className="button" href="/store/cart">Edit cart</a><button className="button button--gold" disabled={!ready} onClick={async () => { const response = await fetch("/api/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: cart.lines }) }); const result = await response.json() as { checkoutUrl?: string; error?: string }; if (response.ok && result.checkoutUrl) window.location.assign(result.checkoutUrl); else setMessage(result.error ?? "Checkout could not be started."); }}>Continue to secure payment</button></div>{variants.length === 0 && !catalog.isPending && <ConfigurationNotice />}{message && <p className="notice notice--bad" role="alert">{message}</p>}</section></>;
}

function CheckoutResult({ approved }: { approved: boolean }) {
  const checkoutReference = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("session_id")?.trim() ?? "";
  const status = useQuery({
    queryKey: ["store", "checkout-status", checkoutReference],
    enabled: Boolean(checkoutReference),
    queryFn: async () => {
      const response = await fetch(`/api/store/checkout/status?sessionId=${encodeURIComponent(checkoutReference)}`);
      const result = await response.json() as { error?: string; order?: { createdAt: string; lines: Array<{ color: string | null; name: string; orderLineId: string; quantity: number; size: string | null; unitPriceCents: number }>; orderId: string; payment: null | { amountCents: number; confirmedAt: string; fulfillmentSubmittedAt: string | null } } };
      if (!response.ok || !result.order) throw new Error(result.error ?? "Checkout order could not be loaded.");
      return result.order;
    },
    retry: false,
  });
  const order = status.data;
  const confirmed = Boolean(order?.payment);
  return <><StoreHead title={approved ? "Order Confirmation" : "Payment Not Completed"} path={approved ? "/store/checkout/approved" : "/store/checkout/declined"} description="Verified persisted checkout state." />{!checkoutReference ? <p className="notice notice--warn">A Stripe checkout session reference is required. No payment result is inferred from this route.</p> : status.isPending ? <p className="notice">Loading persisted order state…</p> : status.isError ? <p className="notice notice--bad" role="alert">{status.error.message}</p> : order ? <section className="card"><h2>Order {order.orderId}</h2><p className={`notice ${confirmed ? "notice--good" : "notice--warn"}`}>{confirmed ? `Payment confirmed ${new Date(order.payment!.confirmedAt).toLocaleString()}.` : approved ? "Stripe returned successfully, but the signed payment webhook has not been persisted yet. Refresh before treating this order as paid." : "No signed payment confirmation is stored for this order."}</p><ul>{order.lines.map((line) => <li key={line.orderLineId}>{line.name} · {line.size ?? "Standard"} · {line.color ?? "Standard"} · quantity {line.quantity} · ${((line.unitPriceCents * line.quantity) / 100).toFixed(2)}</li>)}</ul>{order.payment && <p><strong>Confirmed total: ${(order.payment.amountCents / 100).toFixed(2)}</strong><br />Fulfillment: {order.payment.fulfillmentSubmittedAt ? `submitted ${new Date(order.payment.fulfillmentSubmittedAt).toLocaleString()}` : "not submitted"}</p>}<div className="action-row"><a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}`}>View account order</a><a className="button" href="/store/cart">Return to cart</a></div></section> : null}</>;
}

function GuestStatus() {
  return <><StoreHead title="Order Status" path="/store/orders/:token" description="Tokenized order routes remain private and noindex." /><section className="card"><h2>Order status unavailable</h2><p>Guest checkout is not allowed, and no verified Order token is available. No order details or provider identifiers are exposed.</p></section></>;
}

function Lookup() {
  const [orderId, setOrderId] = useState("");
  const normalizedOrderId = orderId.trim();
  return <><StoreHead title="Order Lookup" path="/store/order-lookup" description="Ownership-checked authenticated order lookup." /><section className="form-card form-card--center"><h2>Find an account order</h2><p>Enter the order identifier from your receipt. The Account order endpoint verifies ownership before returning any details.</p><label className="field">Order identifier<input className="input" value={orderId} onChange={(event) => setOrderId(event.target.value)} /></label><div className="action-row"><a className="button" href="/auth/sign-in?returnTo=%2Fstore%2Forder-lookup">Sign in</a>{normalizedOrderId ? <a className="button button--gold" href={`/account/orders/${encodeURIComponent(normalizedOrderId)}`}>Look up order</a> : <button className="button button--gold" disabled>Look up order</button>}</div><a href="/account/orders">View all account orders</a></section></>;
}

function StoreSupport() {
  return <><StoreHead title="Store Order Support" path="/store/support" description="Merchandise/order support is separate from player/account support." /><section className="card"><h2>Store support owner-deferred</h2><p>Submitting merchandise support requires authenticated Order ownership and a store-support ticket owner. No request is fabricated.</p></section></>;
}

export function StorePage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  let page;
  if (["STORE01", "STORE02", "STORE03", "STORE04"].includes(screen.screenId)) page = <Catalog screen={screen} />;
  else if (screen.screenId === "STORE05") page = <ProductDetail pathname={pathname} />;
  else if (screen.screenId === "STORE06") page = <Cart />;
  else if (screen.screenId === "STORE07") page = <Checkout />;
  else if (screen.screenId === "STORE09" || screen.screenId === "STORE10") page = <CheckoutResult approved={screen.screenId === "STORE10"} />;
  else if (screen.screenId === "STORE11") page = <GuestStatus />;
  else if (screen.screenId === "STORE12") page = <Lookup />;
  else if (screen.screenId === "STORE13") page = <StoreSupport />;
  else page = <><StoreHead title="Store screen unavailable" path={screen.path ?? ""} description="This store screen is not registered." /><p className="notice notice--warn">No store workflow is inferred for an unknown screen.</p></>;
  return <StoreShell><main className="public-page">{page}</main></StoreShell>;
}
