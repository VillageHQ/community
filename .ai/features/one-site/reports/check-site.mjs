// Usage: node check-site.mjs [site dir] [out dir] [chrome.exe]
//   defaults: site/ and .ai/features/common-hall-site/reports/ under the repo root, and Playwright's own Chromium.
// Needs playwright-core: from a folder that has it installed, or the global npm install.
// Serves site/ on a local port and opens it at 320, 390 and 1280 px (light and dark system settings). With motion on
// it waits for the opening drawing, scrolls the whole page and back, and fails on outside requests, console errors,
// failed requests, horizontal overflow or a missing anchor. It then shoots each width full page with reduced motion
// (every stroke drawn) and prints the page.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    const require = createRequire(join(process.env.APPDATA || join(process.env.HOME || "", ".npm-global"), "npm/node_modules/"));
    return require("playwright-core").chromium;
  }
}
const chromium = await loadChromium();

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const [siteDir = join(repo, "site"), outDir = join(repo, ".ai/features/common-hall-site/reports"), exe] = process.argv.slice(2);
const PORT = 55571;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = resolve(siteDir, "." + (path.endsWith("/") ? path + "index.html" : path));
  try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const requests = new Set(); const problems = [];

function watch(page, tag) {
  page.on("request", (r) => requests.add(r.url()));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag}: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag}: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag}: ${r.status()} ${r.url()}`); });
}
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const scheme of ["light", "dark"]) for (const width of [320, 390, 1280]) {
  const tag = `${scheme} ${width}`;
  // 1. motion on: the opening, then the whole page scrolled down and back up
  const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 800 }, colorScheme: scheme, deviceScaleFactor: 1 });
  watch(page, tag);
  await page.goto(ORIGIN, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3600);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  let overflow = await overflowOf(page);
  if (overflow > 0) problems.push(`${tag}: page is ${overflow}px wider than the screen (motion)`);
  if (width === 390 && scheme === "light") {
    const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    if (anchors.length) problems.push("missing anchors: " + anchors.join(", "));
  }
  await page.close();
  // 2. reduced motion: every stroke drawn, shot full page
  const still = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 800 }, colorScheme: scheme, reducedMotion: "reduce", deviceScaleFactor: 1 });
  watch(still, `${tag} reduced`);
  await still.goto(ORIGIN, { waitUntil: "networkidle" });
  await still.evaluate(() => document.fonts.ready);
  overflow = await overflowOf(still);
  if (overflow > 0) problems.push(`${tag}: page is ${overflow}px wider than the screen (reduced motion)`);
  if (scheme === "light") await still.screenshot({ path: join(outDir, `site-${width}.png`), fullPage: true }); // light only: the page has no dark look
  await still.close();
}
const outside = [...requests].filter((u) => !u.startsWith(ORIGIN));
console.log("requests:", requests.size, "outside this site:", outside.length ? outside : "none");
console.log("problems:", problems.length ? problems : "none");
if (outside.length || problems.length) process.exitCode = 1;
{
  const p = await browser.newPage(); await p.goto(ORIGIN, { waitUntil: "networkidle" }); await p.emulateMedia({ media: "print" });
  const printed = await p.evaluate(() => ({ skip: getComputedStyle(document.querySelector(".skip-link")).display, bar: getComputedStyle(document.querySelector(".bar")).display, pen: getComputedStyle(document.getElementById("pen")).display }));
  await p.pdf({ path: join(outDir, "print-check.pdf") }); console.log("print:", printed);
}
await browser.close(); server.close();
