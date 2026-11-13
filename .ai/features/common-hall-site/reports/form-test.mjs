// Usage: node form-test.mjs   (needs playwright-core, local or global)
// Serves site/ locally and checks the sign-up form's empty-endpoint rule: "Schedule call" leads to the form, an empty
// submit marks the four fields, a filled submit sends no request at all and the page says "Nothing was sent".
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function loadChromium() {
  try { return (await import("playwright-core")).chromium; }
  catch { return createRequire(join(process.env.APPDATA || "", "npm/node_modules/"))("playwright-core").chromium; }
}
const chromium = await loadChromium();
const site = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../site");
const PORT = 55572;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = resolve(site, "." + (path.endsWith("/") ? path + "index.html" : path));
  try { res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const sent = []; const errors = [];
page.on("request", (r) => { if (r.method() !== "GET" || !r.url().startsWith(`http://127.0.0.1:${PORT}/`)) sent.push(`${r.method()} ${r.url()}`); });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(3500);
await page.click('.acts a.btn-p[href="#door-managed"]');
await page.waitForTimeout(1500);
const result = {
  heading: await page.textContent("#door-managed h3"),
  formInView: await page.evaluate(() => { const r = document.getElementById("signup-form").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }),
  endpoint: await page.getAttribute("#signup-form", "data-endpoint"),
};
await page.click('#signup-form button[type="submit"]');
result.invalidOnEmptySubmit = await page.$$eval(".field.is-invalid", (els) => els.length);
await page.fill("#f-name", "Sam Ortiz");
await page.fill("#f-fund", "Fieldstone Ventures");
await page.fill("#f-email", "sam@example.com");
await page.fill("#f-members", "120");
await page.click('#signup-form button[type="submit"]');
await page.waitForTimeout(1500);
result.title = await page.textContent("[data-confirm-title]");
result.body = await page.textContent("[data-confirm-body]");
result.requestsSent = sent;
result.consoleErrors = errors;
await page.screenshot({ path: join(dirname(fileURLToPath(import.meta.url)), "form-nothing-sent.png") });
const pass = result.heading === "Schedule a call" && result.formInView && result.endpoint === "" && result.invalidOnEmptySubmit === 4 && sent.length === 0 && errors.length === 0 && /Nothing was sent/.test(result.title) && /stayed in your browser/.test(result.body);
console.log(JSON.stringify(result, null, 1));
console.log(pass ? "PASS" : "FAIL");
if (!pass) process.exitCode = 1;
await browser.close(); server.close();
