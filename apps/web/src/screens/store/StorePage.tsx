import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { StoreShell } from "../../components/shells/Shells";
import { merchandiseConfigurationRequired, storeProductTypes } from "../../domain/store";
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

function Catalog({ screen }: { screen: PageManifestEntry }) {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const productType = categoryProductType[screen.screenId as keyof typeof categoryProductType];
  const configured = catalog.data?.filter((product) => !productType || product.productType === productType) ?? [];
  const expected = screen.screenId === "STORE01" ? storeProductTypes : storeProductTypes.filter((product) => product.productType === productType);
  return <><StoreHead title={screen.title} path={screen.path ?? "/store"} description="The server-configured merchandise catalog." />{catalog.isPending ? <p className="notice">Loading configured merchandise…</p> : catalog.isError ? <p className="notice notice--bad">{catalog.error.message}</p> : configured.length === 0 ? <><div className="product-grid">{expected.map((product) => <article className="product-card" key={product.productType}><div className="product-art" aria-hidden="true"><span>—</span></div><h2>{product.name}</h2><p>Not configured for sale</p><a className="button" href={product.categoryPath}>View category</a></article>)}</div><ConfigurationNotice /></> : <div className="product-grid">{configured.map((product) => <article className="product-card" key={product.storeProductId}><div className="product-art" aria-hidden="true"><span>—</span></div><h2>{product.name}</h2><p>{product.variants.length} available variant(s) · from ${(Math.min(...product.variants.map((variant) => variant.priceCents)) / 100).toFixed(2)}</p><a className="button" href={`/store/products/${encodeURIComponent(product.storeProductId)}`}>View product</a></article>)}</div>}</>;
}

function ProductDetail({ pathname }: { pathname?: string }) {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const productId = pathname?.split("/").at(-1);
  const product = catalog.data?.find((candidate) => candidate.storeProductId === productId);
  return <><StoreHead title="Product Detail" path="/store/products/:slug" description="Configured merchandise product detail." />{catalog.isPending ? <p className="notice">Loading product…</p> : !product ? <section className="card"><h2>Product unavailable</h2><p>No configured product matches this route. Raw Stripe and Printful identifiers are never exposed.</p></section> : <section className="card"><h2>{product.name}</h2><ul>{product.variants.map((variant) => <li key={variant.storeVariantId}>{variant.size ?? "Standard"} · {variant.color ?? "Standard"} · ${(variant.priceCents / 100).toFixed(2)}</li>)}</ul><a className="button button--gold" href="/store/checkout">Choose at checkout</a></section>}</>;
}

function Cart() {
  return <><StoreHead title="Cart" path="/store/cart" description="Authenticated merchandise cart." /><section className="card"><h2>Your cart</h2><p>Select a server-configured variant at checkout. Guest checkout is not allowed and no browser-authored price is accepted.</p><div className="action-row"><a className="button" href="/auth/sign-in?returnTo=%2Fstore%2Fcart">Sign in</a><a className="button button--gold" href="/store/checkout">Open checkout</a></div></section></>;
}

function Checkout() {
  const catalog = useQuery({ queryKey: ["store", "catalog"], queryFn: loadCatalog });
  const variants = catalog.data?.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name }))) ?? [];
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  return <><StoreHead title="Checkout" path="/store/checkout" description="Authenticated Stripe checkout using server-owned variants and prices." /><section className="card form-grid"><h2 className="span-2">Merchandise checkout</h2><label className="field">Configured variant<select className="input" value={variantId} onChange={(event) => setVariantId(event.target.value)}><option value="">Select a variant</option>{variants.map((variant) => <option key={variant.storeVariantId} value={variant.storeVariantId}>{variant.productName} · {variant.size ?? "Standard"} · {variant.color ?? "Standard"} · ${(variant.priceCents / 100).toFixed(2)}</option>)}</select></label><label className="field">Quantity<input className="input" min={1} max={20} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><button className="button button--gold" disabled={!variantId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20} onClick={async () => { const response = await fetch("/api/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: [{ quantity, storeVariantId: variantId }] }) }); const result = await response.json() as { checkoutUrl?: string; error?: string }; if (response.ok && result.checkoutUrl) window.location.assign(result.checkoutUrl); else setMessage(result.error ?? "Checkout could not be started."); }}>Continue to secure payment</button>{variants.length === 0 && !catalog.isPending && <ConfigurationNotice />}{message && <p className="notice notice--bad" role="alert">{message}</p>}</section></>;
}

function CheckoutResult({ approved }: { approved: boolean }) {
  return <><StoreHead title={approved ? "Order Confirmation" : "Payment Declined"} path={approved ? "/store/checkout/approved" : "/store/checkout/declined"} description="Verified checkout result state." /><p className="notice notice--warn">No signed Stripe webhook result or persisted Order was supplied to this route. It does not create, confirm, decline, or fulfill an order.</p><a className="button" href="/store/cart">Return to cart</a></>;
}

function GuestStatus() {
  return <><StoreHead title="Order Status" path="/store/orders/:token" description="Tokenized order routes remain private and noindex." /><section className="card"><h2>Order status unavailable</h2><p>Guest checkout is not allowed, and no verified Order token is available. No order details or provider identifiers are exposed.</p></section></>;
}

function Lookup() {
  return <><StoreHead title="Order Lookup" path="/store/order-lookup" description="Authenticated order lookup." /><section className="form-card form-card--center"><h2>Sign in required</h2><p>Orders are available only through the authenticated account once order persistence is configured.</p><a className="button button--gold" href="/auth/sign-in?returnTo=%2Faccount%2Forders">Sign in</a></section></>;
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
  else if (screen.screenId === "STORE08") page = <StoreSupport />;
  else page = <><StoreHead title="Store screen unavailable" path={screen.path ?? ""} description="This store screen is not registered." /><p className="notice notice--warn">No store workflow is inferred for an unknown screen.</p></>;
  return <StoreShell><main className="public-page">{page}</main></StoreShell>;
}
