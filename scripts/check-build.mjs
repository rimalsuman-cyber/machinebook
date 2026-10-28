import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] || "/";
const html = readFileSync("dist/index.html", "utf8");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (url.startsWith("http")) continue;
  assert.ok(url.startsWith(base), `Incorrect base path: ${url}`);
  assert.ok(
    existsSync("dist/" + url.slice(base.length)),
    `Missing asset: ${url}`,
  );
}
for (const icon of manifest.icons) assert.ok(existsSync("dist/" + icon.src));
assert.ok(existsSync("dist/sw.js"));
const sw = readFileSync("dist/sw.js", "utf8");
assert.ok(sw.includes("index.html"));
assert.ok(sw.includes("icon-192.png"));
assert.ok(!html.includes("YOUR_PROJECT"));
console.log(
  `Production assets, manifest scope, icons and service worker verified for ${base}`,
);
