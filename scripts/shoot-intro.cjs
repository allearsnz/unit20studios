const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  fs.mkdirSync(".screenshots", { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 60000 });
  // sweep runs ~0.2s–1.7s
  await page.waitForTimeout(550);
  await page.screenshot({ path: ".screenshots/sweep-1.png" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".screenshots/sweep-2.png" });
  await page.waitForTimeout(450);
  await page.screenshot({ path: ".screenshots/sweep-3.png" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".screenshots/home-after-intro.png" });

  await browser.close();
  console.log("SWEEP_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
