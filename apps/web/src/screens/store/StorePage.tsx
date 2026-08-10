import type { PageManifestEntry } from "../../lib/page-manifest";
import { StoreShell } from "../../components/shells/Shells";

const products = [
  { conjunction: 1, name: "Mug", price: "$24.00", variant: "11 oz ceramic", path: "/store/products/conjunction-1-mug" },
  { conjunction: 9, name: "Hoodie", price: "$64.00", variant: "Apparel", path: "/store/products/conjunction-9-hoodie" },
  { conjunction: 17, name: "Poster", price: "$32.00", variant: "24 × 36 in", path: "/store/products/conjunction-17-poster" },
] as const;

function StoreHead({ title, path, description }: { title: string; path: string; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">STORE · {path.toUpperCase()}</p><h1>{title}</h1><p>{description}</p></header>;
}

function Catalog({ screen }: { screen: PageManifestEntry }) {
  const selected = screen.screenId === "STORE01" ? products : products.filter((product) => screen.title.toLowerCase().includes(product.name.toLowerCase()));
  return <><StoreHead title={screen.title} path={screen.path ?? "/store"} description="Approval state: DEFAULT" /><p className="notice">Initial catalog is intentionally limited to exactly three products: one mug, one hoodie, and one poster using Conjunction 1, 9, and 17 artwork.</p><div className="product-grid">{selected.map((product) => <article className="product-card" key={product.conjunction}><div className="product-art"><span>{product.conjunction}</span></div><h2>Conjunction {product.conjunction} — {product.name}</h2><p>Approved Conjunction artwork. Printful fulfillment.</p><a className="button" href={product.path}>View product</a></article>)}</div></>;
}

function ProductDetail() {
  return <><StoreHead title="Conjunction 1 — Mug" path="/store/products/:slug" description="A recognizable merchandise product detail page with artwork, variant, price, fulfillment, and purchase action." /><div className="product-detail"><img src="/assets/hero_r007.png" alt="Conjunction 1 mug artwork" /><section><p className="kicker">Mug</p><h2>Conjunction 1 — Mug</h2><p>Approved Conjunction artwork. Printful fulfillment.</p><p className="price">$24.00</p><label className="field">Variant<select className="select" defaultValue="11 oz ceramic"><option>11 oz ceramic</option></select></label><label className="field">Quantity<input className="input" type="number" min="1" defaultValue="1" /></label><a className="button button--gold wide" href="/store/cart">Add to cart</a><p className="notice">Production and shipping estimates are shown before purchase. No fake scarcity.</p></section></div></>;
}

function Cart() {
  return <><StoreHead title="Cart" path="/store/cart" description="A real cart: line items on the left, purchase summary and checkout action on the right." /><div className="checkout-layout"><section className="card"><div className="cart-line"><div className="product-art product-art--small"><span>1</span></div><div><h2>Conjunction 1 — Mug</h2><p>11 oz ceramic · Qty 1</p></div><strong>$24.00</strong></div><div className="cart-line"><div className="product-art product-art--small"><span>17</span></div><div><h2>Conjunction 17 — Poster</h2><p>24 × 36 in · Qty 1</p></div><strong>$32.00</strong></div></section><aside className="card"><h2>Summary</h2><dl className="summary"><dt>Subtotal</dt><dd>$56.00</dd><dt>Shipping / tax</dt><dd>At checkout</dd></dl><p className="price">$56.00</p><a className="button button--gold wide" href="/store/checkout">Checkout</a><small>Guest checkout is allowed. Sign in is recommended only to save the order to an account.</small></aside></div></>;
}

function Checkout() {
  return <><StoreHead title="Checkout" path="/store/checkout" description="Contact and delivery information with the order summary kept visible." /><div className="checkout-layout"><form className="card form-grid"><h2>Contact</h2><label className="field span-2">Email<input className="input" type="email" defaultValue="guest@example.com" /></label><h2>Delivery</h2><label className="field span-2">Full name<input className="input" /></label><label className="field span-2">Address<input className="input" /></label><label className="field">City<input className="input" /></label><label className="field">Postal code<input className="input" /></label><label className="field">State / region<input className="input" /></label><label className="field">Country<select className="select"><option>United States</option></select></label></form><aside className="card"><h2>Order summary</h2><p>2 items</p><dl className="summary"><dt>Subtotal</dt><dd>$56.00</dd><dt>Shipping</dt><dd>Calculated next</dd></dl><button className="button button--gold wide">Continue to Stripe</button><small>Guest checkout allowed.</small></aside></div></>;
}

function CheckoutResult({ approved }: { approved: boolean }) {
  return <><StoreHead title={approved ? "Order Confirmed" : "Payment Declined"} path={approved ? "/store/checkout/approved" : "/store/checkout/declined"} description={approved ? "A single order was created and the fulfillment handoff state is visible." : "The cart is preserved and no fulfillment request is submitted."} /><p className={`notice notice--${approved ? "good" : "bad"}`}>{approved ? "Payment approved. Order #EID-10482 was created once." : "The payment could not be completed. Your cart is still intact."}</p><div className="grid-2">{approved ? <><article className="card"><h2>Confirmation</h2><p>Receipt sent to guest@example.com</p><p>2 items · $56.00 before shipping/tax</p><button className="button">View receipt</button></article><article className="card"><h2>Fulfillment</h2><span className="tag">SUBMISSION QUEUED</span><p>Printful status will update here after the handoff completes.</p><button className="button">Order status</button></article></> : <><article className="card"><h2>Try again</h2><p>Review the payment method or return to Stripe to retry. No duplicate order has been created.</p><button className="button button--gold">Retry payment</button></article><article className="card"><h2>Order not submitted</h2><p>Printful fulfillment has not been started.</p><a className="button" href="/store/cart">Return to cart</a></article></>}</div></>;
}

function GuestStatus() {
  return <><StoreHead title="Guest Order Status" path="/store/orders/:token" description="Tokenized, privacy-safe order status view." /><div className="checkout-layout"><section className="card"><h2>Order #EID-10482</h2><table className="data-table"><thead><tr><th>Item</th><th>Status</th></tr></thead><tbody><tr><td>Conjunction 1 Mug</td><td>In production</td></tr><tr><td>Conjunction 17 Poster</td><td>Queued</td></tr></tbody></table></section><aside className="card"><h2>Tracking</h2><p>Tracking appears once the applicable item ships.</p><a className="button" href="/auth/sign-in">Sign in to save order</a></aside></div></>;
}

function Lookup() {
  return <><StoreHead title="Find a Guest Order" path="/store/order-lookup" description="Use the email and order token from the receipt. This is an actual lookup form, not a requirement list." /><form className="form-card form-card--center"><h2>Order Lookup</h2><label className="field">Email<input className="input" type="email" /></label><label className="field">Order token<input className="input" /></label><p className="notice">Responses are privacy-safe and rate-limited.</p><button className="button button--gold">Find order</button></form></>;
}

function StoreSupport() {
  return <><StoreHead title="Store Order Support" path="/store/support" description="Merchandise/order support is separate from player/account support." /><form className="checkout-layout"><section className="card form-stack"><h2>Order</h2><label className="field">Order number / token<input className="input" /></label><label className="field">Contact email<input className="input" type="email" /></label><label className="field">Issue category<select className="select"><option>Damaged / missing / wrong item</option></select></label></section><section className="card form-stack"><h2>Describe the issue</h2><label className="field">Message<textarea className="textarea" defaultValue="Tell us what happened." /></label><label className="field">Photo evidence<input className="input" type="file" accept="image/*" /></label><button className="button button--gold">Submit</button></section></form></>;
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
