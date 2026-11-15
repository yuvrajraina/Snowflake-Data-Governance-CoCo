import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "dist");
const outputPrefix = `${projectRoot}${path.sep}`;

if (!outputDirectory.startsWith(outputPrefix) || path.basename(outputDirectory) !== "dist") {
  throw new Error("Refusing to build outside the project dist directory");
}

const deployContext = process.env.CONTEXT || "local";
const indexable = process.env.SEO_INDEXABLE
  ? process.env.SEO_INDEXABLE === "true"
  : deployContext === "production";
const rawSiteUrl = process.env.SITE_URL || process.env.URL || (indexable ? "" : "http://localhost:8888");

if (!rawSiteUrl) {
  throw new Error("A production build requires Netlify URL or SITE_URL for canonical SEO output");
}

function normalizeOrigin(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("SITE_URL must use HTTP or HTTPS");
  return parsed.origin;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[character]);
}

function replaceMeta(html, attribute, name, content) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta ${attribute}="${escapedName}" content="[^"]*">`);
  if (!expression.test(html)) throw new Error(`Missing ${attribute} metadata for ${name}`);
  return html.replace(expression, `<meta ${attribute}="${name}" content="${content}">`);
}

function replaceCanonical(html, canonicalUrl) {
  const expression = /<link rel="canonical" href="[^"]*">/;
  if (!expression.test(html)) throw new Error("Missing canonical link");
  return html.replace(expression, `<link rel="canonical" href="${canonicalUrl}">`);
}

function updateStructuredData(html, siteOrigin) {
  const expression = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
  const match = html.match(expression);
  if (!match) throw new Error("Missing JSON-LD structured data");
  const structuredData = JSON.parse(match[1]);
  const graph = structuredData["@graph"];
  if (!Array.isArray(graph)) throw new Error("Structured data graph is invalid");

  const software = graph.find(item => {
    const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    return types.includes("SoftwareApplication");
  });
  const faq = graph.find(item => item["@type"] === "FAQPage");
  if (!software || !faq) throw new Error("Required structured data entities are missing");

  const rootUrl = `${siteOrigin}/`;
  software["@id"] = `${rootUrl}#application`;
  software.url = rootUrl;
  software.image = `${siteOrigin}/assets/social-card.png`;
  faq["@id"] = `${rootUrl}#faq`;
  graph.unshift({
    "@type": "WebSite",
    "@id": `${rootUrl}#website`,
    url: rootUrl,
    name: "Heimdall Governance Studio",
    description: "Browser-local Snowflake data governance configuration and SQL generation.",
    inLanguage: "en-US",
    sameAs: ["https://github.com/yuvrajraina/Snowflake-Data-Governance-CoCo"]
  });

  const json = JSON.stringify(structuredData, null, 2).replaceAll("<", "\\u003c");
  return html.replace(expression, `<script type="application/ld+json">\n${json}\n  </script>`);
}

function createHeaders(html, siteOrigin, allowIndexing) {
  const structuredData = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (structuredData === undefined) throw new Error("Cannot calculate the structured-data CSP hash");
  const structuredDataHash = createHash("sha256").update(structuredData).digest("base64");
  const robotsHeader = allowIndexing ? "" : "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex";

  return `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.sheetjs.com 'sha256-${structuredDataHash}'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; media-src 'none'; worker-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 0
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
${robotsHeader}

/
  Cache-Control: public, max-age=0, must-revalidate
  Link: <${siteOrigin}/>; rel="canonical"

/index.html
  Cache-Control: public, max-age=0, must-revalidate
  Link: <${siteOrigin}/>; rel="canonical"

/404.html
  Cache-Control: public, max-age=0, must-revalidate
  X-Robots-Tag: noindex, follow

/app.js
  Cache-Control: public, max-age=0, must-revalidate

/styles.css
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/favicon.svg
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/site.webmanifest
  Cache-Control: public, max-age=86400, must-revalidate

/sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/robots.txt
  Cache-Control: public, max-age=3600, must-revalidate

/docs/*
  X-Robots-Tag: noindex, follow
  Cache-Control: public, max-age=3600, must-revalidate
`;
}

const siteOrigin = normalizeOrigin(rawSiteUrl);
const rootUrl = `${siteOrigin}/`;
const robotsDirective = indexable
  ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
  : "noindex, nofollow, noarchive, nosnippet, noimageindex";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of ["index.html", "404.html", "styles.css", "app.js", "favicon.svg", "site.webmanifest"]) {
  await cp(path.join(projectRoot, file), path.join(outputDirectory, file));
}
await cp(path.join(projectRoot, "docs"), path.join(outputDirectory, "docs"), { recursive: true });
await mkdir(path.join(outputDirectory, "assets"), { recursive: true });
for (const asset of ["heimdall-mark.svg", "social-card.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
  await cp(path.join(projectRoot, "assets", asset), path.join(outputDirectory, "assets", asset));
}

let indexHtml = await readFile(path.join(projectRoot, "index.html"), "utf8");
indexHtml = replaceMeta(indexHtml, "name", "robots", robotsDirective);
indexHtml = replaceMeta(indexHtml, "name", "googlebot", robotsDirective);
indexHtml = replaceMeta(indexHtml, "property", "og:url", rootUrl);
indexHtml = replaceMeta(indexHtml, "property", "og:image", `${siteOrigin}/assets/social-card.png`);
indexHtml = replaceMeta(indexHtml, "name", "twitter:image", `${siteOrigin}/assets/social-card.png`);
indexHtml = replaceCanonical(indexHtml, rootUrl);
indexHtml = updateStructuredData(indexHtml, siteOrigin);
await writeFile(path.join(outputDirectory, "index.html"), indexHtml, "utf8");

const robots = indexable
  ? `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`
  : "User-agent: *\nAllow: /\n\n# This non-production deploy uses page-level noindex directives.\n";
await writeFile(path.join(outputDirectory, "robots.txt"), robots, "utf8");

if (indexable) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${escapeXml(rootUrl)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;
  await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemap, "utf8");
}

await writeFile(path.join(outputDirectory, "_headers"), createHeaders(indexHtml, siteOrigin, indexable), "utf8");
await writeFile(path.join(outputDirectory, "_redirects"), "/studio /#studio 302\n", "utf8");

console.log(`Built ${indexable ? "indexable production" : "non-indexable preview"} site for ${siteOrigin}`);
