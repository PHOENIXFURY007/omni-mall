# OmniMall Progress Update

Generated: 2026-07-10

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
- Product search, zero-result fallback, graph recommendations, comparison, checkout link creation, adapter preview, and adapter validation.
- ChatGPT Apps widget resources and CSP handling.
- Merchant profiles for Shinsegae, Lotte, Lotte Hi-Mart, Olive Young, Daiso, and Amore Pacific.
- Sample products remain for merchants without real datasets, but real collected datasets replace sample overlap for collected merchants.

Important runtime endpoint:

- Local MCP: `http://127.0.0.1:8787/mcp`
- Current ngrok endpoint: `https://0562-1-233-113-242.ngrok-free.app/mcp`

## Planning Documents

- `plan_v1.md`: detailed development plan and architecture for Codex to follow.
- `docs/data-collection-todo-v2.md`: data collection backlog and source status for merchants that were not fully collectable in V1.
- `progress_update.md`: this file.

## Data Collection

Data is saved separately per merchant, with raw and normalized files.

Collected datasets:

| Merchant | Raw file | Normalized file | Count | Source |
| --- | --- | --- | ---: | --- |
| Amore Mall | `data/amore-products.raw.json` | `data/amore-products.normalized.json` | 500 | Public product detail pages |
| Olive Young | `data/olive-young-products.raw.json` | `data/olive-young-products.normalized.json` | 500 | Public sitemap + product detail-data endpoint |
| Lotte Hi-Mart | `data/lotte-himart-products.raw.json` | `data/lotte-himart-products.normalized.json` | 500 | Public sitemap + Schema.org Product JSON-LD |

Collection status files:

- `data/merchant-collection-status.json`
- `data/merchant-product-manifest.json`
- `data/collection-runs/`

Robots-aware collection notes:

- Olive Young collection respects robots policy and the observed `5s` crawl delay.
- Olive Young public collection initially hit a transient DNS `EAI_AGAIN`; retry/backoff was added to prevent a single network wobble from killing the full run.
- Hi-Mart had no crawl-delay requirement observed, but uses a small throttle.
- Blocked or ambiguous merchants were not faked.

## Additional Source Checks

The following sources were checked and recorded in `docs/data-collection-todo-v2.md`:

- COSRX Korea: `https://cosrx.co.kr/robots.txt`
  - Allows `/`, disallows `/makeshop/`.
  - Sitemap has 216 product-like `shop/shopdetail.html` URLs.
  - V2 needs a MakeShop sitemap/detail parser.
- Sulwhasoo US: `https://us.sulwhasoo.com/robots.txt`
  - Shopify storefront, public product catalog allowed.
  - UCP/MCP discovery available.
  - Public Shopify JSON returned 115 products.
- Innisfree JP: `https://www.innisfree.jp/robots.txt`
  - Shopify storefront, public product catalog allowed.
  - UCP/MCP discovery available.
  - Public Shopify JSON returned 127 products.

## V2 Backlog

See `docs/data-collection-todo-v2.md` for detailed reasons and next actions.

Current blocked or incomplete merchants:

- Lotte Home Shopping: generic crawling blocked by robots.
- LotteON: generic crawling blocked; only named bots/groups allowed.
- Musinsa: generic crawling blocked; named bots/groups only.
- LFmall: generic crawling blocked.
- Yogiyo: `/api/` blocked and menu data is location-sensitive.
- Lotte Wellfood: valid robots/source still needs confirmation.
- Lotte Chilsung: official commerce source still needs confirmation.
- CJ OnStyle: robots response ambiguous, returned HTML during audit.
- COSRX: collectable-looking source, but V2 parser needed.
- Sulwhasoo US: generic Shopify/UCP collector needed; only 115 public products.
- Innisfree JP: generic Shopify/UCP collector needed; only 127 public products.

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

These commands passed after the 500-product Olive Young collection and sample-overlap cleanup:

- `npm run build`
- `npm run smoke`
- `npm test`
- `npm run test:e2e`

Runtime catalog counts after cleanup:

- `amore-pacific`: 500
- `olive-young`: 500
- `lotte-himart`: 500
- `shinsegae`: 3 sample products
- `lotte`: 3 sample products
- `daiso`: 2 sample products

## Important Implementation Notes

- `src/data/catalog.ts` removes sample products for a merchant when a real collected dataset exists.
- `src/mcp/resources.ts` includes CSP image/redirect domains for Amore, Olive Young, and Hi-Mart.
- `scripts/collect-merchant-products.ts` supports `COLLECT_MERCHANTS` so a single merchant can be refreshed without re-running all collectors.
- `scripts/lib/robots.ts` provides robots parsing, audit, allow/disallow evaluation, and crawl-delay support.
- Logs and pid files are intentionally ignored through `.gitignore`.

## Do Not Forget

- Do not invent product data for blocked merchants.
- Do not scrape checkout/cart/account/payment/private API paths.
- Keep raw and normalized files separate per merchant.
- Add CSP resource domains whenever a new merchant image host is introduced.
- Rebuild and restart the MCP server after data or code changes so ChatGPT sees the latest catalog.
