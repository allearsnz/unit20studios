const { chromium } = require("playwright");
const fs = require("fs");

const PAGES = [
  ["studio", "/", 4200],
  ["pricing", "/studio/pricing", 1800],
  ["book", "/studio/book", 2600],
  ["hire-cdj", "/hire/cdj-hire-christchurch", 1800],
  ["contact", "/contact", 1800],
  ["admin-login", "/admin/login", 1500],
];

(async () => {
  fs.mkdirSync(".screenshots", { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const [name, path, wait] of PAGES) {
    await page.goto("http://localhost:3000" + path, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `.screenshots/page-${name}.png` });
    console.log("shot", name);
  }
  await browser.close();
  console.log("PAGES_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
