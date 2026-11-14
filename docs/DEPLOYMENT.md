# Deployment

## Deployment model

The repository is a static Netlify site with:

- build command `npm test && npm run build && npm run test:deploy`;
- no third-party Node dependencies;
- publish directory `dist`;
- Node.js 22 selected by `.nvmrc` and `netlify.toml`;
- production-aware canonical, sitemap, robots and security-header generation;
- deploy-preview and branch-deploy `noindex` protection.

Repository:

```text
https://github.com/yuvrajrainamastek/governance-script-studio
```

## Connect GitHub to Netlify

1. Sign in to Netlify.
2. Choose **Add new project** → **Import an existing project**.
3. Select GitHub and authorize access to the repository if required.
4. Select `yuvrajrainamastek/governance-script-studio`.
5. Use branch `main`.
6. Leave the detected build command unchanged. Netlify reads it from `netlify.toml`.
7. Confirm the publish directory is `dist`.
8. Deploy.

Every push to `main` will create a production deployment unless the Netlify project is configured differently.

## Recommended Netlify settings

- Enable deploy previews for pull requests.
- Protect production changes through pull-request review.
- Do not add secrets; the site has no secret-bearing runtime configuration.
- Set the preferred custom domain as Netlify's primary domain before requesting indexing. Netlify's read-only `URL` build variable then becomes the canonical origin automatically.
- Keep form handling, functions and identity disabled unless a reviewed requirement introduces them.
- Keep deploy previews enabled. The build applies HTML and HTTP `noindex` directives to them automatically.

## Local preview

```powershell
git clone https://github.com/yuvrajrainamastek/governance-script-studio.git
cd governance-script-studio
npm test
$env:CONTEXT = 'production'
$env:SEO_INDEXABLE = 'true'
$env:SITE_URL = 'https://example.com'
npm run build
npm run test:deploy
python -m http.server 8080 --directory dist
```

Open:

```text
http://localhost:8080
```

Stop the server with `Ctrl+C`.

## Manual archive deployment

Although Git-connected deployment is preferred, a manual Netlify upload should contain the generated contents of `dist` only. Build it with the real production origin first:

```powershell
$env:CONTEXT = 'production'
$env:SEO_INDEXABLE = 'true'
$env:SITE_URL = 'https://your-production-domain.example'
npm run build
npm run test:deploy
```

Upload the `dist` directory. `index.html`, `_headers`, `_redirects`, `robots.txt` and `sitemap.xml` must all be at its root.

For Git-connected production deploys, Netlify supplies the final main-site `URL`; no manual sitemap or canonical substitution is required.

## Search launch checklist

After the primary custom domain and HTTPS certificate are active:

1. Confirm the canonical, `og:url`, social image and JSON-LD URLs use the primary domain.
2. Confirm `/robots.txt` references the same origin's `/sitemap.xml`.
3. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
4. Run Google's Rich Results Test on the production URL.
5. Use Search Console URL Inspection to request indexing of the root page.
6. Confirm deploy-preview URLs return `X-Robots-Tag: noindex` and HTML `noindex`.
7. Do not submit `/#studio` separately; URL fragments are not separate canonical pages.

## Post-deployment verification

1. Confirm the home page and branded 404 page load without console errors.
2. Import a non-sensitive test XLSX or normalized JSON catalogue.
3. Search for a table and confirm its expected catalogue columns.
4. Copy the live-schema query.
5. Export and re-import a draft configuration.
6. Complete a non-production test configuration.
7. Generate eight files.
8. Preview at least files 2, 3 and 5.
9. Download one SQL file and the ZIP.
10. Confirm the ZIP contains exactly eight `.sql` files.

## Troubleshooting

### Catalogue import error

Confirm the spreadsheet contains `TABLE_NAME`, `COLUMN_NAME`, and `DATA_TYPE` headers. For Excel files, confirm the browser can load the pinned SheetJS script from `cdn.sheetjs.com`; otherwise use normalized JSON.

### Blank table list

Import a catalogue first. The table list intentionally starts empty.

### Netlify 404 at root

Confirm the build completed and Netlify is publishing `dist`, not the repository root.

### Production build fails with a missing URL

Netlify supplies `URL` automatically. For a local production build, set `SITE_URL` to the complete public origin before running `npm run build`.

### Preview appears in search metadata

Confirm the deploy context is `deploy-preview` or `branch-deploy`, `SEO_INDEXABLE` is `false`, the HTML robots meta is `noindex`, and the response includes `X-Robots-Tag: noindex`.

### Drafts missing

Drafts are browser-local. They do not move between browsers unless exported as JSON.

### Clipboard unavailable

Clipboard access can be denied by browser permissions. The remainder of the application still works.

## Rollback

Netlify retains previous deploys. Roll back the site using Netlify's deploy history, then revert the corresponding Git commit so the repository and deployed state remain aligned.
