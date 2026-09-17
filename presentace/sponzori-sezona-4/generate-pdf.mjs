import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, "ESPORTARENA-TSV-Sezona-4-partner-deck.pdf");
const types = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css",
  ".js": "text/javascript",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(dir, rel));
  if (!file.startsWith(dir)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 990 } });
await page.goto(`http://127.0.0.1:${port}/index.html`, {
  waitUntil: "networkidle",
  timeout: 60_000,
});
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 500));
await page.pdf({
  path: out,
  landscape: true,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
server.close();
console.log(`PDF: ${out}`);
