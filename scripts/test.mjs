// Test: esbuild bundle test/*.test.ts(x) → node --test (không thêm thư viện test).
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
mkdirSync(path.join(root, "node_modules", ".cache"), { recursive: true });
const out = mkdtempSync(path.join(root, "node_modules", ".cache", "editor-test-"));
try {
  const entries = readdirSync(path.join(root, "test")).filter((f) => /\.test\.tsx?$/.test(f)).map((f) => path.join(root, "test", f));
  await build({ entryPoints: entries, bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" }, jsx: "automatic",
    packages: "external", loader: { ".css": "empty" }, logLevel: "warning" });
  execFileSync(process.execPath, ["--test", ...readdirSync(out).map((f) => path.join(out, f))], { stdio: "inherit" });
} finally { rmSync(out, { recursive: true, force: true }); }
