import { readFileSync } from "node:fs";
const html = readFileSync("dist/index.html", "utf8");

const hasDataModule = /<script[^>]+type=["']module["'][^>]+src=["']data:text\/javascript;base64,/i.test(html);
if (hasDataModule) {
  console.error("❌ Build produced an inline data: module script. Use ?url with an external asset.");
  process.exit(1);
}

const hasInlineImport = /<script[^>]*type=["']module["'][^>]*>[^<]*import\s+["'][.\/].*main\.js["']/i.test(html);
if (hasInlineImport) {
  console.error("❌ Build contains an inline module importing main.js. Remove inline blocks; use ?url.");
  process.exit(1);
}

console.log("✅ Postbuild check: no inline module scripts detected.");
