const { chromium } = require("playwright");
const fs = require("fs");

const URL = "http://localhost:3000/";
const FRAMES = [500, 700, 900, 1100, 1300, 1700];

(async () => {
  fs.mkdirSync(".screenshots", { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  await Promise.all(
    FRAMES.map(async (t) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(t);
      await page.screenshot({ path: `.screenshots/sweep-${t}.png` });
      await ctx.close();
    }),
  );
  await browser.close();
  console.log("PARALLEL_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
