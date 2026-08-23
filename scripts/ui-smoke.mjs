import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#name", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/01-home.png", fullPage: true });

  await page.fill("#name", "Host");
  await page.click("button.btn-primary");
  await page.waitForSelector("text=等待玩家加入", { timeout: 10000 });
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/02-lobby.png", fullPage: true });
  console.log("HEADER", await page.locator("header").innerText());
  console.log("ERRORS", errors.slice(0, 10));
  await browser.close();
  console.log("UI PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
