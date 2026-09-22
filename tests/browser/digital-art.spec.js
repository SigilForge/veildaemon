const { test, expect } = require("@playwright/test");

for (const width of [1440, 390]) {
  test(`digital art shelf renders current character previews at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto("/studio/shelf/digital/");
    expect(response.status()).toBe(200);
    await page.getByRole("link", { name: "Open character dossiers" }).click();
    await expect(page).toHaveURL(/#dossiers$/);
    const cards = page.locator(".dossier-card");
    await expect(cards).toHaveCount(11);
    await expect(page.locator(".book-status")).toContainText("11 named subjects filed");
    for (const [name, filename] of [
      ["Cathy", "cathy-ortho.webp"],
      ["Kira", "kira-ortho.webp"],
      ["Vesper Rook", "vesper-rook-ortho.webp"],
    ]) {
      const card = cards.filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card.locator("img")).toHaveAttribute("src", `/studio/assets/shelf/digital/${filename}?v=20260922-characters1`);
    }
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      const image = card.locator("img");
      await image.evaluate(img => img.decode());
      const dimensions = await image.evaluate(img => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        declaredWidth: Number(img.getAttribute("width")),
        declaredHeight: Number(img.getAttribute("height")),
      }));
      expect(dimensions.width).toBeGreaterThan(0);
      expect(Math.max(dimensions.width, dimensions.height)).toBeLessThanOrEqual(1200);
      expect(dimensions.declaredWidth).toBe(dimensions.width);
      expect(dimensions.declaredHeight).toBe(dimensions.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.locator("#dossiers").screenshot({ path: `/tmp/digital-art-${width}.png` });
  });
}
