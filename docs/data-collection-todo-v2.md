# OmniMall Data Collection TODO V2

Generated for the PoC data collection pass on 2026-07-10.

This file tracks merchants from the screenshot list where product collection was not completed. The rule for V2 is simple: do not create synthetic 500-product files. Only collect when robots policy, public metadata, partner API, or an approved feed permits it.

## Already Collected

| Merchant | Current dataset | Count | Notes |
| --- | --- | ---: | --- |
| Amore Mall | `data/amore-products.normalized.json` | 500 | Existing collected dataset. |
| Lotte Hi-Mart | `data/lotte-himart-products.normalized.json` | 500 | Public sitemap + Schema.org Product JSON-LD. |
| Olive Young | `data/olive-young-products.normalized.json` | 500 | Public collection completed with robots-aware crawl delay. |

## V2 Collection Backlog

| Merchant | Current status | Why collection was not completed | V2 action |
| --- | --- | --- | --- |
| Lotte Home Shopping | Blocked | `robots.txt` blocks generic `User-agent: *` at root. | Request partner product feed/API or explicit crawl permission. |
| LotteON | Blocked | Product paths are allowed only for named bots/groups; generic collector is disallowed. | Use official partner API/feed or approved bot identity. |
| Musinsa | Blocked | `robots.txt` blocks generic `User-agent: *` and allows only named bots/groups. | Use partner API/feed or approved crawler access. |
| LFmall | Blocked | `robots.txt` blocks generic `User-agent: *`. | Use partner API/feed or approved crawler access. |
| Yogiyo | Needs source confirmation | `/api/` is disallowed, and menu data is location-sensitive. | Use official menu/store API, partner export, or a public non-location-sensitive feed. |
| Lotte Wellfood | Needs valid robots/source | `robots.txt` was not available during audit. | Confirm official product domain, robots policy, and product feed/sitemap. |
| Lotte Chilsung | Needs valid source | Candidate mall domain failed during audit. | Confirm official commerce URL or approved product feed/API. |
| CJ OnStyle | Needs valid robots/source | `robots.txt` request returned HTML, so policy is ambiguous. | Confirm valid robots endpoint and product metadata source before collecting. |

## Additional Sources Found On 2026-07-10

| Source | Robots / source check | Public product availability | V2 action |
| --- | --- | --- | --- |
| COSRX Korea, `https://cosrx.co.kr/robots.txt` | Allows `/`; disallows `/makeshop/`. `sitemap.xml` is available. | Sitemap has 216 product-like `shop/shopdetail.html` URLs. | Add a MakeShop sitemap/detail parser. 500 product-level records are not available from the current sitemap alone. |
| Sulwhasoo US, `https://us.sulwhasoo.com/robots.txt` | Shopify storefront allows public product/collection/page HTML. Private checkout/cart/account paths are restricted. UCP/MCP discovery is available. | `/products.json?limit=250` returned 115 products. | Add a generic Shopify/UCP catalog collector. Product-level public count is 115, so 500 requires variants, bundles, additional locales, or partner feed. |
| Innisfree JP, `https://www.innisfree.jp/robots.txt` | Shopify storefront allows public product/collection/page HTML. Private checkout/cart/account paths are restricted. UCP/MCP discovery is available. | `/products.json?limit=250` returned 127 products. | Add a generic Shopify/UCP catalog collector. Product-level public count is 127, so 500 requires variants, additional locales, or partner feed. |

## V2 Acceptance Criteria

- Each merchant gets separate raw and normalized files:
  - `data/<merchant-id>-products.raw.json`
  - `data/<merchant-id>-products.normalized.json`
- Target is 500 products per merchant when source allows it.
- `data/merchant-collection-status.json` must record robots decisions and source notes.
- Image domains must be added to ChatGPT widget CSP before demo.
- No scraped checkout, cart, account, payment, review-report, or private API paths.
