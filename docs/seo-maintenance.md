# SEO maintenance

The homepage renders featured blog links and `ProfilePage` JSON-LD at build time.
Update `assets/data/posts.json` with one to four published articles from
https://blog.devploit.dev/feed.xml, keeping the exact article URLs, titles,
publication timestamps and categories. Then run:

```sh
npm run build
npm run check
```

The build is offline and uses the checked-in snapshot. The browser can refresh
the cards from the live feed; a failed or invalid response preserves the static
cards. Product metadata in the profile comes from `assets/data/projects.json`.
Do not edit generated sections directly. JSON-LD is inert data; executable
inline scripts remain prohibited by the checks and Content Security Policy.

When editing page copy outside generated sections, update that page's sitemap
`lastmod` to the date of its significant change. The build updates `lastmod`
automatically when generated sections change.

## Browser regression checks

Use a test environment with Playwright and Google Chrome installed. Start a
local server in the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

In another terminal, run `npm run check:browser`. If Playwright is installed
outside the project, point `SITE_PLAYWRIGHT_MODULE` to its `index.mjs`:

```sh
SITE_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs npm run check:browser
```

`SITE_BASE_URL` can override the local server URL. The checks cover mobile and
desktop layouts, JavaScript disabled, unavailable and invalid feeds, live feed
refresh, static profile data and canonical internal links. Feed requests and
GitHub star requests are mocked so these tests do not depend on external APIs.

## Hosting follow-up

The canonical homepage and its internal links use `https://devploit.dev/`.
GitHub Pages also serves `/index.html`; a permanent server redirect requires a
hosting or Cloudflare rule and is not deployed by this repository. If configured,
redirect `/index.html` to `/` while preserving the query string, then check the
HTTP response with `curl -I https://devploit.dev/index.html`.

Use Search Console to inspect the canonical URLs and rendered content, and
PageSpeed Insights to measure field performance. Local checks cannot establish
indexing status, search rankings or real-user Core Web Vitals.
