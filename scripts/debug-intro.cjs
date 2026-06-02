const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (m) => console.log("PAGE>", m.text()));
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });

  let prev = 0;
  for (const t of [100, 600, 1100, 1600, 2200, 2900]) {
    await page.waitForTimeout(t - prev);
    prev = t;
    const info = await page.evaluate(() => {
      const el = document.getElementById("u20-intro");
      return {
        present: !!el,
        opacity: el ? getComputedStyle(el).opacity : "-",
        reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
        ss: sessionStorage.getItem("u20_intro"),
      };
    });
    console.log(t + "ms", JSON.stringify(info));
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
