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

function Catalog({ screen }: { screen: PageManifestEntry }) {
  const productType = categoryProductType[screen.screenId as keyof typeof categoryProductType];
  const selected = screen.screenId === "STORE01"
    ? storeProductTypes
    : storeProductTypes.filter((product) => product.productType === productType);
  return <><StoreHead title={screen.title} path={screen.path ?? "/store"} description="The configured merchandise catalog." /><p className="notice">The initial catalog is limited to exactly one Poster, one Mug, and one Hoodie. Exact artwork mapping remains unresolved configuration.</p><div className="product-grid">{selected.map((product) => <article className="product-card" key={product.productType}><div className="product-art" aria-hidden="true"><span>—</span></div><h2>{product.name}</h2><p>Price and variants unavailable</p><a className="button" href={product.categoryPath}>View category</a></article>)}</div><ConfigurationNotice /></>;
}

function ProductDetail() {
  return <><StoreHead title="Product Detail" path="/store/products/:slug" description="Configured merchandise product detail." /><section className="card"><h2>Product unavailable</h2><p>No configured product matches this route. Raw Stripe and Printful identifiers are never exposed.</p><button className="button button--gold" disabled>Add to cart unavailable</button></section><ConfigurationNotice /></>;
}

function Cart() {
  return <><StoreHead title="Cart" path="/store/cart" description="Authenticated merchandise cart." /><section className="card"><h2>Your cart is unavailable.</h2><p>Guest checkout is not allowed. A signed-in account and server-configured product variants are required before cart lines can be created.</p><a className="button" href="/auth/sign-in?returnTo=%2Fstore%2Fcart">Sign in</a></section><ConfigurationNotice /></>;
}

function Checkout() {
  return <><StoreHead title="Checkout" path="/store/checkout" description="Authenticated Stripe checkout." /><section className="card"><h2>Checkout unavailable</h2><p>Guest checkout is not allowed. The browser cannot supply price, variant, payment, order, or fulfillment authority.</p><button className="button button--gold" disabled>Continue to Stripe unavailable</button></section><ConfigurationNotice /></>;
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

export function StorePage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (["STORE01", "STORE02", "STORE03", "STORE04"].includes(screen.screenId)) page = <Catalog screen={screen} />;
  else if (screen.screenId === "STORE05") page = <ProductDetail />;
  else if (screen.screenId === "STORE06") page = <Cart />;
  else if (screen.screenId === "STORE07") page = <Checkout />;
  else if (screen.screenId === "STORE09" || screen.screenId === "STORE10") page = <CheckoutResult approved={screen.screenId === "STORE10"} />;
  else if (screen.screenId === "STORE11") page = <GuestStatus />;
  else if (screen.screenId === "STORE12") page = <Lookup />;
  else if (screen.screenId === "STORE08") page = <StoreSupport />;
  else page = <><StoreHead title="Store screen unavailable" path={screen.path ?? ""} description="This store screen is not registered." /><p className="notice notice--warn">No store workflow is inferred for an unknown screen.</p></>;
  return <StoreShell><main className="public-page">{page}</main></StoreShell>;
}
