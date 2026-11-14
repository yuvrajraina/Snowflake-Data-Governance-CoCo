import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const context = process.env.CONTEXT || "local";
const indexable = process.env.SEO_INDEXABLE
  ? process.env.SEO_INDEXABLE === "true"
  : context === "production";
const expectedOrigin = new URL(process.env.URL || process.env.SITE_URL || "http://localhost:8888").origin;

const read = relativePath => fs.readFileSync(path.join(dist, relativePath), "utf8");
const exists = relativePath => fs.existsSync(path.join(dist, relativePath));

for (const file of [
  "index.html", "404.html", "app.js", "styles.css", "favicon.svg", "site.webmanifest",
  "robots.txt", "_headers", "_redirects", "assets/social-card.png", "assets/icon-192.png",
  "assets/icon-512.png", "assets/apple-touch-icon.png"
]) assert.ok(exists(file), `${file} must exist in the deploy output`);

assert.equal(exists("data/catalog.json"), false, "the unused legacy catalogue must not be public");
assert.equal(exists("assets/icon-source.svg"), false, "source artwork must not be public");
assert.equal(exists("assets/social-card.svg"), false, "source artwork must not be public");

const html = read("index.html");
const headers = read("_headers");
const robots = read("robots.txt");
const canonical = `${expectedOrigin}/`;
const image = `${expectedOrigin}/assets/social-card.png`;

assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`));
assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
assert.ok(html.includes(`<meta property="og:image" content="${image}">`));
assert.ok(html.includes(`<meta name="twitter:image" content="${image}">`));

const jsonLdSource = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
assert.ok(jsonLdSource, "JSON-LD must be present");
const structuredData = JSON.parse(jsonLdSource);
const graph = structuredData["@graph"];
assert.ok(graph.some(item => item["@type"] === "WebSite" && item.url === canonical));
assert.ok(graph.some(item => {
  const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
  return types.includes("SoftwareApplication") && item.url === canonical && item.image === image;
}));

const cspHash = createHash("sha256").update(jsonLdSource).digest("base64");
assert.ok(headers.includes(`'sha256-${cspHash}'`), "CSP must authorize exactly the emitted JSON-LD");
assert.ok(headers.includes("frame-ancestors 'none'"));
assert.ok(headers.includes(`Link: <${canonical}>; rel="canonical"`));

if (indexable) {
  assert.ok(html.includes('name="robots" content="index, follow'));
  assert.ok(robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`));
  assert.ok(exists("sitemap.xml"), "production must include a sitemap");
  assert.ok(read("sitemap.xml").includes(`<loc>${canonical}</loc>`));
  assert.doesNotMatch(headers.split("\n\n/\n")[0], /X-Robots-Tag: noindex/);
} else {
  assert.ok(html.includes('name="robots" content="noindex, nofollow'));
  assert.equal(exists("sitemap.xml"), false, "non-production builds must not include a sitemap");
  assert.match(headers.split("\n\n/\n")[0], /X-Robots-Tag: noindex, nofollow/);
}

const manifest = JSON.parse(read("site.webmanifest"));
assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"));
assert.ok(manifest.icons.some(icon => icon.sizes === "512x512"));

console.log(`PASS: ${indexable ? "production" : "preview"} Netlify output, SEO and security policy`);
