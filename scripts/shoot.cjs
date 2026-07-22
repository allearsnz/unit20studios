// Dev-only: screenshot the studio home page at desktop + mobile for review.
const { chromium } = require("playwright");
const fs = require("fs");

const URL = process.env.SHOOT_URL || "http://localhost:3000/";
const OUT = ".screenshots";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-unsafe-swiftshader",
    ],
  });

  // Desktop — above the fold, then the whole page.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/home-desktop.png` });
  await ctx.close();

  // Full-page pass at 1x — 2x overflows the max capture texture on a tall page.
  const fctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const fpage = await fctx.newPage();
  await fpage.goto(URL, { waitUntil: "load", timeout: 60000 });
  await fpage.waitForTimeout(4000);
  await fpage.screenshot({ path: `${OUT}/home-desktop-full.png`, fullPage: true });
  await fctx.close();

  // Mobile
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await mpage.goto(URL, { waitUntil: "load", timeout: 60000 });
  await mpage.waitForTimeout(4000);
  await mpage.screenshot({ path: `${OUT}/home-mobile.png` });
  await mctx.close();

  await browser.close();
  console.log("SHOTS_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
