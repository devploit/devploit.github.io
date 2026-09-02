# Products showcase on the home page

Date: 2026-09-02. Branch: `feat/products-showcase`.

## Goal

Give the online products (pwny.cc, jwtforge.com, x-utils.com) a first-class place on devploit.dev so visitors both use them and read Daniel as someone who ships and runs product, not only GitHub repos. Approach chosen: a dedicated `// products` section on the home page, separate from the open-source repos, following the existing data-driven pattern. A standalone `/projects.html` is explicitly out of scope for now; the data model must allow it later without changing the home.

## Content

Three products, all shown as live:

| id | Name | URL | One-liner | Highlights | Metric |
| --- | --- | --- | --- | --- | --- |
| pwny | pwny.cc | https://pwny.cc | Payload repository for security researchers. | Curated payloads by category; copy-ready snippets; kept current from real engagements and CTFs | Reference · payloads |
| jwtforge | JWTForge | https://jwtforge.com | Decode, audit and break JWTs, entirely in your browser. | Decode and verify with secret, key or JWKS; heuristic audit signals (alg:none, weak algs, kid/jku/x5u); six attack generators exporting curl, Burp, nuclei and jwt_tool artifacts | 6 attack generators · 0 requests sent |
| x-utils | x-utils | https://x-utils.com | Metrics from X without paying for the API. | Twelve copy-paste console tools; read-only, never asks for a password, no server; HTML report plus CSV and JSON exports | 12 tools · 0 servers |

Open-source repos stay as they are (nomore403, awesome-ctf-resources, debugHunter) under a renamed `// open source` heading with live GitHub stars.

## Data

New file `assets/data/projects.json`:

```json
{
  "products": [
    { "id": "jwtforge", "name": "JWTForge", "domain": "jwtforge.com", "url": "https://jwtforge.com", "status": "live",
      "tagline": "...", "highlights": ["...", "...", "..."], "tags": ["client-side", "free"],
      "metric": { "value": "6", "label": "attack generators" }, "accent": "violet" }
  ],
  "openSource": [
    { "id": "nomore403", "name": "nomore403", "repo": "devploit/nomore403", "url": "https://github.com/devploit/nomore403",
      "starsLabel": "+1700 ★", "description": "...", "tags": ["Go", "ctf"] }
  ]
}
```

`accent` is one of `orange`, `violet`, `sky` and maps to a CSS custom property on the card. `status` is rendered as a label; only `live` is used today.

## Rendering

`scripts/render-cves.mjs` gains two index.html sections rendered from `projects.json`:

- `PRODUCTS_HOME` renders the product cards inside `<section class="products-section" id="products">`.
- `OSS_HOME` renders the open-source cards inside the existing tools section, replacing the hand-written markup.

Markers follow the existing `<!-- NAME:START --> ... <!-- NAME:END -->` convention, so `npm run build` regenerates and `npm run check` fails when HTML and JSON drift. Sitemap `lastmod` for the home is bumped by the existing logic.

## Markup and layout

Section order on the home becomes: hero, proof of work + posts, **products**, research & recognition, open source, footer. Products sit above recognition because they are the new headline and recognition already has its own strong block.

Products section structure mirrors the recognition section: `section-label`, kicker "Built and running", h2 "Tools I ship and keep online.", short mono paragraph, then a three-column grid.

Each product card is an `<a>` wrapping:

- Window chrome strip: three dots and the domain rendered like a URL bar, plus a "live" status pill with a dot.
- Name (Syne 22px) and tagline.
- Three highlights as a mono list with a `›` marker.
- Footer row: metric (large value, small label) on the left, `open ↗` on the right.
- Tags row.

Per-card accent via `data-accent` sets `--p-accent`; used only for the window glow, the status dot and the metric value, so the page stays coherent with the orange brand.

Proof of work gets one new `project` item: "pwny.cc · JWTForge · x-utils", subtitle "Products built and run in production", link `see products` to `#products`.

Nav gains `products` (`#products`) after `work`; `tools` stays and keeps pointing to `#tools`. `home.js` active-section observer includes `#products`.

Hover and focus: same lift as the tool cards, visible focus ring inherited from base styles, `aria-label` with "(opens in new tab)". Reduced motion disables the status dot pulse and the lift.

Responsive: three columns above 1024px, two between 768 and 1024, one below 768.

## SEO and structured data

- Meta description and OG/Twitter descriptions mention "Builds pwny.cc, JWTForge and x-utils."
- `home.js` appends an `ItemList` of `SoftwareApplication` entries to the existing JSON-LD, read from the rendered cards (`data-product-url`, `data-product-name`, tagline), so there is still no inline script and the data stays single-sourced in the HTML.

## Checks

`scripts/check-site.mjs` adds:

- `projects.json` ids unique, every product has `url` starting with `https://`, exactly three highlights, `accent` in the allowed set.
- Rendered `index.html` contains each product URL inside the `PRODUCTS_HOME` markers and each repo URL inside `OSS_HOME`.
- Nav contains `href="#products"` and `home.js` observes `#products`.

`npm run check` must pass. Visual verification: local server plus headless Chrome screenshots at 1440 and 420 wide, reviewed before anything is pushed.

## Out of scope

Standalone projects page, screenshots or OG images per product, analytics events on outbound clicks, changes to inner pages.
