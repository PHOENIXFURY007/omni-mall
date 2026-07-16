# OmniMall Progress Update

Generated: 2026-07-13

This document is a handoff note for future Codex work on the OmniMall PoC. It summarizes the architecture, implementation, data collection, verification, and remaining V2 tasks completed so far.

## Repository

- Local path: `C:\Users\SDS\workspace\omni-mall`
- Git remote: `https://github.com/PHOENIXFURY007/omni-mall.git`
- Node is available at `C:\Program Files\nodejs\`.
- Git may not be on PATH in PowerShell; use `C:\Program Files\Git\cmd\git.exe` if needed.

## Product Scope

OmniMall is an agentic cross-merchant shopping PoC built around:

- ChatGPT Apps SDK / MCP demonstration platform.
- Merchant adapters using a common product schema.
- Hybrid product search, similar-product graph exploration, comparison, checkout handoff, and adapter validation.
- Compatibility planning for OpenAI Agents SDK, Claude Agent SDK, and Google ADK through MCP/A2A-friendly boundaries.
- OAuth/auth planning in `plan_v1.md`, with external checkout and confirmation-first purchase flows.

## Implemented Application

Core TypeScript project and scripts were added:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `src/`
- `scripts/`
- `test/`
- `.gitignore`

Main runtime features:

- MCP HTTP server in `src/server.ts`.
- Google OAuth/OIDC-backed MCP auth is now implemented:
  - OAuth protected resource metadata: `/.well-known/oauth-protected-resource/mcp`
  - OAuth authorization server metadata: `/.well-known/oauth-authorization-server`
  - OpenID metadata: `/.well-known/openid-configuration`
  - Dynamic client registration: `POST /register`
  - Authorization, token, callback, JWKS, and userinfo routes: `/authorize`, `/token`, `/callback`, `/jwks`, `/userinfo`
  - Local tokens are signed by `data/oauth-jwt-private-key.pem`; generated OAuth runtime files are ignored by git.
  - `create_checkout_link` and `mcp_current_user` require Google OAuth scope `omnimall.checkout` and return `mcp/www_authenticate` challenges when unauthenticated.
  - Search, graph exploration, comparison, adapter preview, and validation remain public guest tools.
  - Real Google login still requires server env vars: `PUBLIC_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- Product search, zero-result fallback, graph recommendations, comparison, checkout link creation, adapter preview, and adapter validation.
- ChatGPT Apps widget resources and CSP handling.
- Widget product cards render images for every runtime product. Collected products use source image URLs; sample-only products use neutral placeholders.
- Widget graph rendering now shows a nearest-neighbor board with seed/neighbor product images, edge relation, edge weight, and edge reason instead of raw product-id-only graph cards.
- Widget `Similar` and `Checkout` buttons call MCP tools from inside the component and hydrate the returned structured result back into the widget. Tool descriptors set `openai/widgetAccessible: true`, and the widget URI is bumped to `ui://widget/omni-mall-products-v4.html` to avoid stale ChatGPT resource caching.
- `graph-ui-v1` update changes the graph section into a real node-link visualization: product images are rendered as positioned graph vertices, SVG lines render the similarity/substitute/complement edges, and edge labels show relation + weight. The widget URI for this version is `ui://widget/omni-mall-products-graph-ui-v1.html`.
- Merchant profiles for Shinsegae, Lotte, Lotte Hi-Mart, Kurly, StyleKorean, Olive Young, Daiso, and Amore Pacific.
- Added runtime merchant profiles for Sulwhasoo US and Innisfree JP after public Shopify catalog collection.
- Sample products remain for merchants without real datasets, but real collected datasets replace sample overlap for collected merchants.

Important runtime endpoint:

- Local MCP: `http://127.0.0.1:8787/mcp`
- Current ngrok endpoint: `https://0562-1-233-113-242.ngrok-free.app/mcp`
- Current OAuth metadata URL for ChatGPT: `https://0562-1-233-113-242.ngrok-free.app/.well-known/oauth-protected-resource/mcp`

## Planning Documents

- `plan_v1.md`: detailed development plan and architecture for Codex to follow.
- `docs/data-collection-todo-v2.md`: data collection backlog and source status for merchants that were not fully collectable in V1.
- `progress_update.md`: this file.

## Latest Auth Verification

Completed after adding Google OAuth support:

- `npm test`
- `npm run test:e2e`
- `npm run smoke`
- Restarted local server on `127.0.0.1:8787` with `PUBLIC_BASE_URL=https://0562-1-233-113-242.ngrok-free.app`.
- Verified local and ngrok OAuth metadata endpoints return `200` and advertise:
  - issuer `https://0562-1-233-113-242.ngrok-free.app`
  - authorization endpoint `/authorize`
  - token endpoint `/token`
  - registration endpoint `/register`
  - scope `omnimall.checkout`

Current caveat:

- `healthz.auth.configured` is `false` until Google Cloud OAuth credentials are provided in the server environment. ChatGPT can discover OAuth, but a real Gmail/Google sign-in cannot complete without those credentials and the matching Google redirect URI.

## Data Collection

Data is saved separately per merchant, with raw and normalized files.

Collected datasets:

| Merchant | Raw file | Normalized file | Count | Source |
| --- | --- | --- | ---: | --- |
| Amore Mall | `data/amore-products.raw.json` | `data/amore-products.normalized.json` | 500 | Public product detail pages |
| Olive Young | `data/olive-young-products.raw.json` | `data/olive-young-products.normalized.json` | 500 | Public sitemap + product detail-data endpoint |
| Lotte Hi-Mart | `data/lotte-himart-products.raw.json` | `data/lotte-himart-products.normalized.json` | 500 | Public sitemap + Schema.org Product JSON-LD |
| Kurly | `data/kurly-products.raw.json` | `data/kurly-products.normalized.json` | 500 | Public goods sitemap + Schema.org Product JSON-LD |
| StyleKorean | `data/stylekorean-products.raw.json` | `data/stylekorean-products.normalized.json` | 500 | Public product sitemap + Schema.org Product JSON-LD |
| Sulwhasoo US | `data/sulwhasoo-us-products.raw.json` | `data/sulwhasoo-us-products.normalized.json` | 115 | Public Shopify products JSON |
| Innisfree JP | `data/innisfree-jp-products.raw.json` | `data/innisfree-jp-products.normalized.json` | 127 | Public Shopify products JSON |

Candidate-only dataset:

| Source | Raw file | Normalized file | Count | Status |
| --- | --- | --- | ---: | --- |
| COSRX Korea | `data/cosrx-korea-products.raw.json` | `data/cosrx-korea-products.normalized.json` | 216 URL candidates, 0 normalized products | MakeShop detail/category pages returned anti-abuse block content to the collector IP. Do not bypass; use approved feed/API or explicit permission. |

Collection status files:

- `data/merchant-collection-status.json`
- `data/merchant-product-manifest.json`
- `data/collection-runs/`

Robots-aware collection notes:

- Olive Young collection respects robots policy and the observed `5s` crawl delay.
- Olive Young public collection initially hit a transient DNS `EAI_AGAIN`; retry/backoff was added to prevent a single network wobble from killing the full run.
- Hi-Mart had no crawl-delay requirement observed, but uses a small throttle.
- Kurly and StyleKorean are collected from public sitemap-discovered product pages and Schema.org Product JSON-LD.
- The collector user-agent was changed to avoid matching StyleKorean's blocked `oBot` robots group by substring.
- HTML/XML fetching now decodes response charsets such as `euc-kr` to preserve Korean product text.
- Blocked or ambiguous merchants were not faked.

## Additional Source Checks

The following sources were checked and recorded in `docs/data-collection-todo-v2.md`:

- COSRX Korea: `https://cosrx.co.kr/robots.txt`
  - Allows `/`, disallows `/makeshop/`.
  - Sitemap has 216 product-like `shop/shopdetail.html` URLs.
  - Raw URL candidates are saved in `data/cosrx-korea-products.raw.json`.
  - Detail/category requests returned MakeShop anti-abuse block content, so runtime normalization remains blocked pending approved feed/API or permission.
- Sulwhasoo US: `https://us.sulwhasoo.com/robots.txt`
  - Shopify storefront, public product catalog allowed.
  - UCP/MCP discovery available.
  - Public Shopify JSON collector implemented; 115 normalized products saved.
- Innisfree JP: `https://www.innisfree.jp/robots.txt`
  - Shopify storefront, public product catalog allowed.
  - UCP/MCP discovery available.
  - Public Shopify JSON collector implemented; 127 normalized products saved.
- Kurly: `https://www.kurly.com/robots.txt`
  - Public product/goods paths and sitemap index were usable for the generic collector.
  - Goods sitemaps exposed product URLs with Schema.org Product JSON-LD.
  - Runtime collector implemented; 500 normalized products saved.
- StyleKorean: `https://www.stylekorean.com/robots.txt`
  - Generic `User-agent: *` allows public paths except admin/plugin paths.
  - Product sitemap exposes product URLs with Schema.org Product JSON-LD.
  - Runtime collector implemented; 500 normalized products saved.
- Major Korean marketplace audit:
  - Coupang, Gmarket, Auction, and Ably returned HTTP 403 to generic robots/source probes.
  - Musinsa, Naver Shopping, 11st, SSG.COM, GS Shop, Hyundai Hmall, W Concept, LotteON, Lotte Home Shopping, and LFmall are blocked for generic collection by robots policy.
  - Zigzag, 29CM, Danawa, and KREAM need a confirmed product-level public feed/API before collection.

## V2 Backlog

See `docs/data-collection-todo-v2.md` for detailed reasons and next actions.

Current blocked or incomplete merchants:

- Coupang: generic robots/source probes returned HTTP 403.
- Naver Shopping: generic crawling blocked by robots.
- Gmarket: generic robots/source probes returned HTTP 403.
- Auction: generic robots/source probes returned HTTP 403.
- 11st: generic crawling blocked by robots.
- SSG.COM: generic crawling blocked by robots.
- GS Shop: generic crawling blocked by robots.
- Hyundai Hmall: generic crawling blocked by robots.
- W Concept: generic crawling blocked by robots.
- Ably: generic robots/source probes returned HTTP 403.
- Zigzag: no confirmed product-level public feed/sitemap yet.
- 29CM: no confirmed product-level public feed/sitemap yet.
- Danawa: no confirmed product-level public feed/sitemap yet.
- KREAM: stable valid robots/source still needs confirmation.
- Lotte Home Shopping: generic crawling blocked by robots.
- LotteON: generic crawling blocked; only named bots/groups allowed.
- Musinsa: generic crawling blocked; named bots/groups only.
- LFmall: generic crawling blocked.
- Yogiyo: `/api/` blocked and menu data is location-sensitive.
- Lotte Wellfood: valid robots/source still needs confirmation.
- Lotte Chilsung: official commerce source still needs confirmation.
- CJ OnStyle: robots response ambiguous, returned HTML during audit.
- COSRX: candidate URL collection exists, but detail normalization is blocked by MakeShop anti-abuse response.
- Sulwhasoo US: runtime collector implemented; 500 requires variants, bundles, additional locales, or partner feed.
- Innisfree JP: runtime collector implemented; 500 requires variants, additional locales, or partner feed.

## Commands

Use PowerShell with Node on PATH:

```powershell
$env:Path='C:\Program Files\nodejs;' + $env:Path
```

Install/build/test:

```powershell
npm install
npm run build
npm run smoke
npm test
npm run test:e2e
```

Run the MCP server:

```powershell
npm run start
```

Collect merchants:

```powershell
npm run collect:amore
npm run collect:merchants
```

Run only one merchant:

```powershell
$env:COLLECT_MERCHANTS='olive-young'
$env:OLIVE_SOURCE_MODE='public'
$env:OLIVE_TARGET_COUNT='500'
npm run collect:merchants
```

## Verification Completed

These commands passed after the Kurly and StyleKorean collection/runtime wiring update:

- `npm run build`
- `npm run smoke`
- `npm test`
- `npm run test:e2e`

Runtime catalog counts after cleanup:

- `amore-pacific`: 500
- `olive-young`: 500
- `lotte-himart`: 500
- `kurly`: 500
- `stylekorean`: 500
- `sulwhasoo-us`: 115
- `innisfree-jp`: 127
- `shinsegae`: 3 sample products
- `lotte`: 3 sample products
- `daiso`: 2 sample products
- Runtime merchant count: 10
- Audited collection source count in `data/merchant-collection-status.json`: 29
- Runtime product image coverage: 2,750 / 2,750 products have image URLs.
- Graph outputs include `graphProducts` so the widget can resolve graph edge IDs into visual product nodes.

## Important Implementation Notes

- `src/data/catalog.ts` removes sample products for a merchant when a real collected dataset exists.
- `src/mcp/resources.ts` includes CSP image/redirect domains for Amore, Olive Young, Hi-Mart, Kurly, StyleKorean, Shopify merchants, and sample placeholder images.
- `scripts/collect-merchant-products.ts` supports `COLLECT_MERCHANTS` so a single merchant can be refreshed without re-running all collectors.
- `scripts/collect-merchant-products.ts` includes sitemap + JSON-LD collection for Kurly, StyleKorean, and Lotte Hi-Mart; Shopify catalog collection for Sulwhasoo US and Innisfree JP; and COSRX sitemap-candidate capture.
- `scripts/lib/robots.ts` provides robots parsing, audit, allow/disallow evaluation, and crawl-delay support.
- Logs and pid files are intentionally ignored through `.gitignore`.

## Do Not Forget

- Do not invent product data for blocked merchants.
- Do not scrape checkout/cart/account/payment/private API paths.
- Keep raw and normalized files separate per merchant.
- Add CSP resource domains whenever a new merchant image host is introduced.
- Rebuild and restart the MCP server after data or code changes so ChatGPT sees the latest catalog.
