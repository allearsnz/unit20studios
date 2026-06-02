const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  fs.mkdirSync(".screenshots", { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // anchor on DOM ready (≈ when the intro timer starts)
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const times = [500, 800, 1100, 1400, 1800];
  let prev = 0;
  for (const t of times) {
    await page.waitForTimeout(t - prev);
    prev = t;
    await page.screenshot({ path: `.screenshots/sweep-${t}.png` });
  }
  await browser.close();
  console.log("SWEEP_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
