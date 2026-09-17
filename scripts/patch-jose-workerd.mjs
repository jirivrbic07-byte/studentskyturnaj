/**
 * OpenNext na Cloudflare balí Worker přes podmínku "workerd".
 * jose@4 (závislost jwks-rsa / firebase-admin) exportuje
 * "./dist/browser/index.js", ale OpenNext ten soubor do .open-next
 * nezkopíruje. Přepíšeme workerd/worker/browser na Node CJS, který
 * tracer opravdu kopíruje.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function walkJosePackages(dir, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      walkJosePackages(full, found);
      continue;
    }
    if (entry.name === "jose") {
      const pkgPath = path.join(full, "package.json");
      if (fs.existsSync(pkgPath)) found.push(pkgPath);
    }
    const nested = path.join(full, "node_modules");
    if (fs.existsSync(nested)) walkJosePackages(nested, found);
  }
  return found;
}

function resolveExportPath(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  if (typeof value.default === "string") return value.default;
  if (typeof value.require === "string") return value.require;
  return null;
}

function existingRelative(pkgDir, candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const abs = path.join(pkgDir, candidate);
    if (fs.existsSync(abs)) return candidate;
  }
  return null;
}

function patchJosePackage(pkgPath) {
  const pkgDir = path.dirname(pkgPath);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const rootExport = pkg.exports?.["."];
  if (!rootExport || typeof rootExport !== "object") return false;
  if (!rootExport.workerd) return false;

  const fallback = existingRelative(pkgDir, [
    resolveExportPath(rootExport.require),
    resolveExportPath(rootExport.default),
    "./dist/node/cjs/index.js",
    "./dist/webapi/index.js",
  ]);
  if (!fallback) return false;

  const conditions = ["workerd", "worker", "browser", "bun", "deno"];
  let changed = false;
  for (const condition of conditions) {
    const current = resolveExportPath(rootExport[condition]);
    if (!current || current === fallback) continue;
    rootExport[condition] = fallback;
    changed = true;
  }

  if (typeof pkg.browser === "string" && pkg.browser !== fallback) {
    pkg.browser = fallback;
    changed = true;
  }
  if (typeof pkg.deno === "string" && pkg.deno !== fallback) {
    pkg.deno = fallback;
    changed = true;
  }

  if (!changed) return false;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

const nodeModules = path.join(root, "node_modules");
const packages = walkJosePackages(nodeModules);
let patched = 0;
for (const pkgPath of packages) {
  if (patchJosePackage(pkgPath)) patched += 1;
}

if (patched > 0) {
  console.log(`patched jose workerd export (${patched})`);
}
