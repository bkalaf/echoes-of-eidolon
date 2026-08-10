import { useState, useSyncExternalStore } from "react";

import { StoreShell } from "../../components/shells/Shells";
import {
  addCartLine,
  cartSubtotalCents,
  formatUsd,
  readCart,
  storeProducts,
  writeCart,
  type CartLine,
  type StoreSku,
} from "../../domain/store";
import type { PageManifestEntry } from "../../lib/page-manifest";

const emptyCart: CartLine[] = [];
let cachedCartSource: string | null | undefined;
let cachedCart: CartLine[] = emptyCart;

function cartSnapshot(): CartLine[] {
  if (typeof window === "undefined") return emptyCart;
  const source = window.localStorage.getItem("echoes.store.cart.v1");
  if (source !== cachedCartSource) {
    cachedCartSource = source;
    cachedCart = readCart(window.localStorage);
  }
  return cachedCart;
}

function subscribeToCart(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener("echoes-cart-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("echoes-cart-change", callback);
  };
}

function saveCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  writeCart(window.localStorage, lines);
  cachedCartSource = undefined;
  window.dispatchEvent(new Event("echoes-cart-change"));
}

function StoreHead({ title, path, description }: { title: string; path: string; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">STORE · {path.toUpperCase()}</p><h1>{title}</h1><p>{description}</p></header>;
}

function Catalog({ screen }: { screen: PageManifestEntry }) {
  const selected = screen.screenId === "STORE01"
    ? storeProducts
    : storeProducts.filter((product) => screen.title.toLowerCase().includes(product.name.toLowerCase()));
  return <><StoreHead title={screen.title} path={screen.path ?? "/store"} description="Approval state: DEFAULT" /><p className="notice">The reviewed catalog contains exactly one mug, one hoodie, and one poster using Conjunction 1, 9, and 17 artwork.</p><div className="product-grid">{selected.map((product) => <article className="product-card" key={product.sku}><div className="product-art"><span>{product.conjunction}</span></div><h2>Conjunction {product.conjunction} — {product.name}</h2><p>{product.variant} · Printful fulfillment</p><p className="price">{formatUsd(product.priceCents)}</p><a className="button" href={product.path}>View product</a></article>)}</div></>;
}

function ProductDetail() {
  const product = storeProducts[0];
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const addToCart = () => {
    if (typeof window === "undefined") return;
    try {
      const next = addCartLine(readCart(window.localStorage), product.sku, quantity);
      saveCart(next);
      setError(undefined);
      setMessage(`${quantity} added to cart.`);
    } catch (caught) {
      setMessage(undefined);
      setError(caught instanceof Error ? caught.message : "The cart could not be updated.");
    }
  };

  return <><StoreHead title="Conjunction 1 — Mug" path="/store/products/:slug" description="Merchandise product detail with reviewed artwork, variant, price, and fulfillment owner." /><div className="product-detail"><img src="/assets/hero_r007.png" alt="Conjunction 1 mug artwork" /><section><p className="kicker">Mug</p><h2>Conjunction 1 — Mug</h2><p>Approved Conjunction artwork. Printful fulfillment.</p><p className="price">{formatUsd(product.priceCents)}</p><label className="field">Variant<select className="select" value={product.variant} disabled><option>{product.variant}</option></select></label><label className="field">Quantity<input aria-label="Quantity" className="input" type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.valueAsNumber)} /></label><button className="button button--gold wide" onClick={addToCart}>Add to cart</button>{message && <p className="notice notice--good" role="status">{message} <a href="/store/cart">View cart</a></p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}<p className="notice">No scarcity or provider estimate is shown without live Printful data.</p></section></div></>;
}

function useStoredCart() {
  const lines = useSyncExternalStore(subscribeToCart, cartSnapshot, () => emptyCart);
  return [lines, saveCart] as const;
}

function Cart() {
  const [lines, saveLines] = useStoredCart();
  const subtotal = cartSubtotalCents(lines);
  const updateQuantity = (sku: StoreSku, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    saveLines(lines.map((line) => line.sku === sku ? { ...line, quantity } : line));
  };
  return <><StoreHead title="Cart" path="/store/cart" description="Current local cart lines and purchase summary." /><div className="checkout-layout"><section className="card">{lines.length === 0 ? <><h2>Your cart is empty.</h2><a className="button" href="/store">Browse merchandise</a></> : lines.map((line) => { const product = storeProducts.find((candidate) => candidate.sku === line.sku)!; return <div className="cart-line" key={line.sku}><div className="product-art product-art--small"><span>{product.conjunction}</span></div><div><h2>Conjunction {product.conjunction} — {product.name}</h2><p>{product.variant}</p><label className="field">Quantity<input aria-label={`${product.name} quantity`} className="input" type="number" min="1" max="99" value={line.quantity} onChange={(event) => updateQuantity(line.sku, event.target.valueAsNumber)} /></label><button className="button" onClick={() => saveLines(lines.filter((candidate) => candidate.sku !== line.sku))}>Remove</button></div><strong>{formatUsd(product.priceCents * line.quantity)}</strong></div>; })}</section><aside className="card"><h2>Summary</h2><dl className="summary"><dt>Subtotal</dt><dd>{formatUsd(subtotal)}</dd><dt>Shipping / tax</dt><dd>Requires checkout</dd></dl><p className="price">{formatUsd(subtotal)}</p>{lines.length > 0 && <a className="button button--gold wide" href="/store/checkout">Checkout</a>}<small>Guest checkout is permitted by the reviewed flow.</small></aside></div></>;
}

function Checkout() {
  const [lines] = useStoredCart();
  const subtotal = cartSubtotalCents(lines);
  return <><StoreHead title="Checkout" path="/store/checkout" description="Contact and delivery layout with the current cart summary visible." /><div className="checkout-layout"><section className="card form-grid"><h2>Contact</h2><label className="field span-2">Email<input className="input" type="email" /></label><h2>Delivery</h2><label className="field span-2">Full name<input className="input" /></label><label className="field span-2">Address<input className="input" /></label><label className="field">City<input className="input" /></label><label className="field">Postal code<input className="input" /></label><label className="field">State / region<input className="input" /></label><label className="field">Country<input className="input" /></label></section><aside className="card"><h2>Order summary</h2><p>{lines.reduce((total, line) => total + line.quantity, 0)} items</p><dl className="summary"><dt>Subtotal</dt><dd>{formatUsd(subtotal)}</dd><dt>Shipping</dt><dd>Unavailable</dd></dl><button className="button button--gold wide" disabled>Continue to Stripe unavailable</button><p className="notice notice--warn">Payment is blocked until Printful product/variant identifiers, shipping quotes, order persistence, webhook idempotency, and authenticated administrative ownership are supplied.</p></aside></div></>;
}

function CheckoutResult({ approved }: { approved: boolean }) {
  return <><StoreHead title={approved ? "Order Confirmed" : "Payment Declined"} path={approved ? "/store/checkout/approved" : "/store/checkout/declined"} description="Checkout result state." /><p className="notice notice--warn">No verified Stripe checkout result or persisted Order was supplied to this route. It does not create, confirm, decline, or submit an order.</p><a className="button" href="/store/cart">Return to cart</a></>;
}

function GuestStatus() {
  return <><StoreHead title="Guest Order Status" path="/store/orders/:token" description="Tokenized, privacy-safe order status view." /><section className="card"><h2>Order status unavailable</h2><p>No token verifier or Order/Printful query owner is supplied. No order details are exposed.</p></section></>;
}

function Lookup() {
  return <><StoreHead title="Find a Guest Order" path="/store/order-lookup" description="Email and receipt-token lookup layout." /><section className="form-card form-card--center"><h2>Order Lookup</h2><label className="field">Email<input className="input" type="email" /></label><label className="field">Order token<input className="input" /></label><button className="button button--gold" disabled>Find order unavailable</button><p className="notice notice--warn">Lookup remains disabled until a rate-limited, privacy-safe Order token owner exists.</p></section></>;
}

function StoreSupport() {
  return <><StoreHead title="Store Order Support" path="/store/support" description="Merchandise/order support is separate from player/account support." /><section className="card"><h2>Store support owner-deferred</h2><p>Submitting merchandise support requires verified Order lookup and a store-support ticket owner. No request is fabricated.</p></section></>;
}

export function StorePage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (["STORE01", "STORE02", "STORE03", "STORE04"].includes(screen.screenId)) page = <Catalog screen={screen} />;
  else if (screen.screenId === "STORE05") page = <ProductDetail />;
  else if (screen.screenId === "STORE06") page = <Cart />;
  else if (screen.screenId === "STORE07") page = <Checkout />;
  else if (screen.screenId === "STORE09" || screen.screenId === "STORE10") page = <CheckoutResult approved={screen.screenId === "STORE10"} />;
  else if (screen.screenId === "STORE11") page = <GuestStatus />;
  else if (screen.screenId === "STORE12") page = <Lookup />;
  else page = <StoreSupport />;
  return <StoreShell><main className="public-page">{page}</main></StoreShell>;
}
