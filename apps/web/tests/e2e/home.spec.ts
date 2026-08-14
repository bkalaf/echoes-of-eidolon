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
  await expect(page.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
  await expect(page.locator(".feature-carousel")).toBeVisible();
  await expect(page.getByText("Free to Play. Open to Everyone.")).toBeVisible();
  await expect(page.locator(".public-footer")).toBeVisible();
});

test("feature carousel renders stable two-tone vector crests without masks", async ({ page }) => {
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
      href: crest.querySelector("use")?.getAttribute("href"),
      maskImage: style.maskImage,
      tagName: crest.tagName.toLowerCase(),
      width: rect.width,
    };
  }));

  const before = await readCrests();
  expect(before).toHaveLength(9);
  expect(new Set(before.map(({ asset }) => asset)).size).toBe(9);
  expect(new Set(before.map(({ color }) => color))).toEqual(new Set(["blue", "yellow", "red"]));
  expect(before.every(({ asset }) => asset?.endsWith(".svg"))).toBe(true);
  expect(before.every(({ height, href, maskImage, tagName, width }) => height === 58 && width === 58 && href?.startsWith("/crests/region-crests.svg#crest-") && maskImage === "none" && tagName === "svg")).toBe(true);
  await expect(page.locator(".feature-card img")).toHaveCount(0);

  await page.getByRole("button", { name: "Next feature" }).click();
  expect(await readCrests()).toEqual(before);
  expect(failedCrests).toEqual([]);
});

test("homepage remains vertically stationary while the carousel advances", async ({ page }) => {
  test.setTimeout(60_000);
  for (const viewport of [
    { width: 1_600, height: 900 },
    { width: 1_920, height: 1_080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const readLayout = () => page.evaluate(() => {
      const main = document.querySelector<HTMLElement>(".site-main");
      const footer = document.querySelector<HTMLElement>(".public-footer");
      const hero = document.querySelector<HTMLElement>(".hero");
      const carousel = document.querySelector<HTMLElement>(".feature-carousel");
      const cta = document.querySelector<HTMLElement>(".hero-free-cta");
      const heroCopy = document.querySelector<HTMLElement>(".hero-copy");
      if (!main || !footer || !hero || !carousel || !cta || !heroCopy) throw new Error("Homepage layout is incomplete.");
      const ctaRect = cta.getBoundingClientRect();
      const heroCopyRect = heroCopy.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      return {
        activeFeature: document.querySelector(".feature-card.active")?.getAttribute("href"),
        carouselLeft: carousel.scrollLeft,
        footerBottom: footer.getBoundingClientRect().bottom,
        ctaBottomGap: heroRect.bottom - ctaRect.bottom,
        ctaInsideHero: ctaRect.left >= heroRect.left && ctaRect.right <= heroRect.right && ctaRect.top >= heroRect.top && ctaRect.bottom <= heroRect.bottom,
        ctaIsLowerRight: ctaRect.left > heroRect.left + heroRect.width / 2 && ctaRect.top > heroRect.top + heroRect.height / 2,
        ctaOverlapsHeroCopy: !(ctaRect.right <= heroCopyRect.left || ctaRect.left >= heroCopyRect.right || ctaRect.bottom <= heroCopyRect.top || ctaRect.top >= heroCopyRect.bottom),
        footerTop: footer.getBoundingClientRect().top,
        heroHeight: heroRect.height,
        heroTop: heroRect.top,
        mainClientHeight: main.clientHeight,
        mainOverflowY: getComputedStyle(main).overflowY,
        mainScrollHeight: main.scrollHeight,
        mainY: main.scrollTop,
        windowY: window.scrollY,
      };
    });

    const initial = await readLayout();
    expect(initial.windowY).toBe(0);
    expect(initial.mainY).toBe(0);
    expect(initial.mainOverflowY).toBe("hidden");
    expect(initial.mainScrollHeight).toBe(initial.mainClientHeight);
    expect(initial.footerBottom).toBeLessThanOrEqual(viewport.height);
    expect(initial.ctaInsideHero).toBe(true);
    expect(initial.ctaIsLowerRight).toBe(true);
    expect(initial.ctaOverlapsHeroCopy).toBe(false);
    expect(initial.ctaBottomGap).toBeGreaterThanOrEqual(10);
    expect(initial.heroHeight).toBeGreaterThan(viewport.width === 1_600 ? 540 : 720);
    await expect(page.locator(".home-screen > .free-band")).toHaveCount(0);

    const carouselPositions = [initial.carouselLeft];
    for (let tick = 0; tick < 4; tick += 1) {
      await page.waitForTimeout(3_100);
      const current = await readLayout();
      carouselPositions.push(current.carouselLeft);
      expect(current.windowY).toBe(initial.windowY);
      expect(current.mainY).toBe(initial.mainY);
      expect(current.heroTop).toBe(initial.heroTop);
      expect(current.heroHeight).toBe(initial.heroHeight);
      expect(current.footerBottom).toBeLessThanOrEqual(viewport.height);
      expect(current.ctaInsideHero).toBe(true);
    }

    const after = await readLayout();
    expect(after.activeFeature).not.toBe(initial.activeFeature);
    expect(new Set(carouselPositions).size).toBeGreaterThan(1);
  }
});

test("application shells own the viewport while long pages scroll only inside their content region", async ({ page }) => {
  for (const [path, width, height] of [
    ["/", 1_600, 900],
    ["/features", 1_600, 900],
    ["/gameplay", 1_366, 768],
    ["/store", 1_366, 768],
    ["/status", 1_366, 768],
    ["/account/profile", 1_366, 768],
    ["/admin", 1_366, 768],
    ["/game", 1_366, 768],
    ["/auth/sign-in", 390, 844],
    ["/features", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".site-shell, .workspace-shell, .game-shell");
      const main = document.querySelector(".workspace-main, .game-shell > main")
        ?? document.querySelector(".site-main > .public-page, .site-main > .auth-page")
        ?? document.querySelector(".site-main");
      const header = document.querySelector(".public-header, .workspace-header");
      const footer = document.querySelector(".public-footer, .workspace-footer, .game-bottom-bar");
      if (!shell || !main || !footer) throw new Error("Application shell structure is incomplete.");
      const shellRect = shell.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      return {
        bodyClientHeight: document.body.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        footerBottom: footerRect.bottom,
        footerOverlap: mainRect.bottom - footerRect.top,
        headerTop: headerRect?.top,
        mainOverflowY: getComputedStyle(main).overflowY,
        shellBottom: shellRect.bottom,
        shellTop: shellRect.top,
      };
    });

    expect(layout.documentScrollHeight).toBe(layout.documentClientHeight);
    expect(layout.bodyScrollHeight).toBe(layout.bodyClientHeight);
    expect(layout.shellTop).toBe(0);
    expect(layout.shellBottom).toBe(height);
    expect(layout.headerTop ?? 0).toBe(0);
    expect(layout.footerBottom).toBe(height);
    expect(layout.footerOverlap).toBe(0);
    expect(layout.mainOverflowY).toBe(path === "/" ? "hidden" : "auto");
  }
});

test("Features uses the shared crests and keeps native video controls unobstructed", async ({ page }) => {
  await page.setViewportSize({ width: 1_600, height: 900 });
  await page.goto("/features");
  await expect(page.locator(".feature-tile .region-crest")).toHaveCount(9);
  await expect(page.locator(".feature-tile img")).toHaveCount(0);
  const panel = page.locator(".video-panel--features");
  const caption = panel.locator(".video-caption");
  await expect(panel.locator("video[controls]")).toBeVisible();
  await expect(caption).toHaveCSS("opacity", "1");
  await expect(caption).toHaveCSS("pointer-events", "none");
  await panel.hover();
  await expect(caption).toHaveCSS("opacity", "0");
  await page.locator(".page-head").hover();
  await expect(caption).toHaveCSS("opacity", "1");
  await panel.locator("video").focus();
  await expect(caption).toHaveCSS("opacity", "0");
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
      expect(framing.verticalVisibleFraction).toBeGreaterThanOrEqual(0.45);
      expect(framing.verticalVisibleFraction).toBeLessThanOrEqual(0.8);
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
    await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible({ timeout: 15_000 });
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
  expect(sitemapBody).not.toMatch(/\/auth|\/account|\/admin|\/game(?:\/|<)|\/review|\/store\/orders/);

  await page.goto("/features/free-to-play");
  await expect(page.getByRole("heading", { name: "Free to Play. Open to Everyone." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");

  await page.goto("/auth/sign-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
});
