// Usage (from a folder with playwright-core installed): node check-site.mjs <site dir> <out dir> <chrome.exe>
// Serves site/ on a local port, screenshots it at 390 and 1280 px in light and dark, and logs every request.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const [siteDir, outDir, exe] = process.argv.slice(2);
const PORT = 55571;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = resolve(siteDir, "." + (path.endsWith("/") ? path + "index.html" : path));
  try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: exe });
const requests = new Set(); const problems = [];
for (const scheme of ["light", "dark"]) for (const width of [320, 390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
  page.on("request", (r) => requests.add(r.url()));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${scheme} ${width}: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${scheme} ${width}: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`${scheme} ${width}: page is ${overflow}px wider than the screen`);
  await page.screenshot({ path: join(outDir, `site-${width}-${scheme}.png`), fullPage: true });
  if (width === 390 && scheme === "light") {
    await page.click(".menu-toggle"); await page.screenshot({ path: join(outDir, `site-390-menu.png`) });
    const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    if (anchors.length) problems.push("missing anchors: " + anchors.join(", "));
  }
  await page.close();
}
await browser.close(); server.close();
const outside = [...requests].filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}/`));
console.log("requests:", [...requests].length, "outside this site:", outside.length ? outside : "none");
console.log("problems:", problems.length ? problems : "none");
if (outside.length || problems.length) process.exitCode = 1;
{ const b2 = await chromium.launch({ executablePath: exe }); const s2 = createServer(server.listeners("request")[0]); await new Promise((r) => s2.listen(PORT, "127.0.0.1", r));
  const p = await b2.newPage(); await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" }); await p.emulateMedia({ media: "print" });
  const printed = await p.evaluate(() => ({ skip: getComputedStyle(document.querySelector(".skip-link")).display, faqOpenCss: [...document.querySelectorAll(".faq details p")].every((e) => e.getClientRects().length > 0) }));
  await p.pdf({ path: join(outDir, "print-check.pdf") }); console.log("print:", printed); await b2.close(); s2.close(); }
