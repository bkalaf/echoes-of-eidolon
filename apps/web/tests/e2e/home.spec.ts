import { expect, test } from "@playwright/test";

test("home exposes the approved public task and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  await expect(page.locator(".feature-card")).toHaveCount(9);
});

test("public navigation remains readable at the supported mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation).toBeVisible();
  for (const name of ["Features", "Gameplay", "Merchandise", "Game & Server Status", "Request an Invite"]) {
    await expect(navigation.getByRole("link", { name })).toHaveCSS("white-space", "nowrap");
  }
});

test("feature carousel replaces circular medallions with stable colored regional crests", async ({ page }) => {
  const failedCrests: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/crests/") && response.status() >= 400) failedCrests.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await page.goto("/");

  const readCrests = () => page.locator(".feature-card .region-crest").evaluateAll((crests) => crests.map((crest) => {
    const style = getComputedStyle(crest);
    const rect = crest.getBoundingClientRect();
    return {
      asset: crest.getAttribute("data-crest-asset"),
      color: crest.getAttribute("data-crest-color"),
      height: rect.height,
      maskMode: style.maskMode,
      maskRepeat: style.maskRepeat,
      maskSize: style.maskSize,
      width: rect.width,
    };
  }));

  const before = await readCrests();
  expect(before).toHaveLength(9);
  expect(new Set(before.map(({ asset }) => asset)).size).toBe(9);
  expect(new Set(before.map(({ color }) => color))).toEqual(new Set(["blue", "yellow", "red"]));
  expect(before.every(({ asset }) => asset?.endsWith(".svg"))).toBe(true);
  expect(before.every(({ height, maskMode, maskRepeat, maskSize, width }) => height === 58 && width === 58 && maskMode === "luminance" && maskRepeat === "no-repeat" && maskSize === "contain")).toBe(true);
  await expect(page.locator(".feature-card img")).toHaveCount(0);

  await page.getByRole("button", { name: "Next feature" }).click();
  expect(await readCrests()).toEqual(before);
  expect(failedCrests).toEqual([]);
});

test("homepage hero crops only its lower foreground and keeps the carousel in normal flow", async ({ page }) => {
  for (const [width, height] of [
    [2_560, 1_440],
    [1_920, 1_080],
    [1_600, 900],
    [1_440, 900],
    [1_366, 768],
    [1_024, 768],
    [768, 1_024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const framing = await page.locator(".hero").evaluate((hero) => {
      const image = hero.querySelector("img");
      if (!image) throw new Error("Hero image is missing.");
      const style = getComputedStyle(image);
      const heroRect = hero.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const featureBand = hero.nextElementSibling?.getBoundingClientRect();
      return {
        carouselFlowGap: featureBand ? featureBand.top - heroRect.bottom : null,
        carouselTop: featureBand?.top,
        heroHeight: heroRect.height,
        heroWidth: hero.clientWidth,
        imageAspectRatio: imageRect.width / imageRect.height,
        imageTopGap: imageRect.top - heroRect.top,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition.split(" ").map((value) => Number.parseFloat(value)),
        renderedImageHeight: imageRect.height,
        renderedImageWidth: imageRect.width,
        verticalVisibleFraction: heroRect.height / imageRect.height,
      };
    });

    expect(framing.naturalWidth).toBe(1_672);
    expect(framing.naturalHeight).toBe(941);
    expect(framing.heroWidth).toBeGreaterThanOrEqual(width - 1);
    expect(framing.heroWidth).toBeLessThanOrEqual(width);
    expect(framing.carouselFlowGap).toBe(0);
    expect(framing.imageTopGap).toBe(0);
    expect(framing.objectPosition[0]).toBeGreaterThanOrEqual(35);
    expect(framing.objectPosition[0]).toBeLessThanOrEqual(45);
    expect(framing.objectPosition[1]).toBe(0);
    if (width > 600) {
      expect(framing.objectFit).toBe("contain");
      expect(framing.renderedImageWidth).toBeGreaterThanOrEqual(width - 1);
      expect(framing.imageAspectRatio).toBeCloseTo(1_672 / 941, 2);
      expect(framing.verticalVisibleFraction).toBeGreaterThanOrEqual(0.7);
      expect(framing.verticalVisibleFraction).toBeLessThanOrEqual(0.78);
    } else {
      expect(framing.objectFit).toBe("cover");
      expect(framing.heroHeight).toBeLessThanOrEqual(315);
    }
    if (width === 1_600) {
      expect(framing.heroHeight).toBeLessThanOrEqual(680);
      expect(framing.carouselTop).toBeLessThan(750);
    }
  }
});

test("packet routes expose public, auth, account, and store tasks", async ({ page }) => {
  for (const [path, heading] of [
    ["/features", "Nine ways Echoes plays differently."],
    ["/auth/sign-in", "Sign In"],
    ["/account/subscription?state=ACC008", "Subscription - Active"],
    ["/store/checkout/declined", "Payment Not Completed"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByText("A Stripe checkout session reference is required. No payment result is inferred from this route.")).toBeVisible();
});

test("administration routes expose canonical editor, import, atlas, and campaign tasks", async ({ page }) => {
  for (const [path, heading] of [
    ["/admin/data/witness/sample-record", "Edit Witness"],
    ["/admin/data/breed/import", "Bulk Import Breed"],
    ["/admin/atlas/pois?state=ATLAS_POI_3D", "Points of Interest — 3D View"],
    ["/admin/campaign/planner?state=CAMPAIGN_CONCORD", "Main 18-Book Planner — Concord"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("game routes require an authenticated eligible player", async ({ page }) => {
  for (const path of [
    "/game?state=GAME_VIEW_SINGLE_EXIT",
    "/game/knowledge?state=GAME016",
    "/game/bookshelf",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  }
});

test("review routes expose routed and state-only tasks", async ({ page }) => {
  for (const [path, text] of [
    ["/review/controls/lookups?state=TOOL003", "Control Gallery - Enum Selects"],
    ["/tools/wireframe-builder", "Wireframe Builder"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
});

test("Atlas data is not disclosed without administrative authorization", async ({ page }) => {
  const response = await page.request.get("/api/atlas/catalog");
  expect(response.status()).toBe(401);
  await page.goto("/admin/atlas/pois?state=ATLAS_POI_2D");
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  await expect(page.getByText("92 canonical Points of Interest")).not.toBeVisible();
});

test("crawlability allowlists public pages and excludes protected surfaces", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /store/orders/");

  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemap.status()).toBe(200);
  expect(sitemapBody).toContain("/features/free-to-play</loc>");
  expect(sitemapBody).not.toMatch(/\/auth|\/account|\/admin|\/game|\/review|\/store\/orders/);

  await page.goto("/features/free-to-play");
  await expect(page.getByRole("heading", { name: "Free to Play. Open to Everyone." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");

  await page.goto("/auth/sign-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
});
