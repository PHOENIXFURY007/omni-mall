# OmniMall Data Collection TODO V2

Generated for the PoC data collection pass on 2026-07-13.

This file tracks merchants from the screenshot list where product collection was not completed. The rule for V2 is simple: do not create synthetic 500-product files. Only collect when robots policy, public metadata, partner API, or an approved feed permits it.

## Already Collected

| Merchant | Current dataset | Count | Notes |
| --- | --- | ---: | --- |
| Amore Mall | `data/amore-products.normalized.json` | 500 | Existing collected dataset. |
| Lotte Hi-Mart | `data/lotte-himart-products.normalized.json` | 500 | Public sitemap + Schema.org Product JSON-LD. |
| Olive Young | `data/olive-young-products.normalized.json` | 500 | Public collection completed with robots-aware crawl delay. |
| Kurly | `data/kurly-products.normalized.json` | 500 | Public goods sitemap + Schema.org Product JSON-LD. |
| StyleKorean | `data/stylekorean-products.normalized.json` | 500 | Public product sitemap + Schema.org Product JSON-LD. |
| Sulwhasoo US | `data/sulwhasoo-us-products.normalized.json` | 115 | Public Shopify products JSON. UCP/MCP discovery is available. |
| Innisfree JP | `data/innisfree-jp-products.normalized.json` | 127 | Public Shopify products JSON. UCP/MCP discovery is available. |

## V2 Collection Backlog

| Merchant | Current status | Why collection was not completed | V2 action |
| --- | --- | --- | --- |
| Coupang | Blocked | Robots/source probes returned HTTP 403 to the generic collector. | Use official partner API/feed or approved crawler access. |
| Naver Shopping | Blocked | `robots.txt` disallows generic `User-agent: *` at root. | Use official shopping/search API or approved feed. |
| Gmarket | Blocked | Robots/source probes returned HTTP 403 to the generic collector. | Use approved API/feed. |
| Auction | Blocked | Robots/source probes returned HTTP 403 to the generic collector. | Use approved API/feed. |
| 11st | Blocked | `robots.txt` disallows generic `User-agent: *` at root. | Use approved API/feed. |
| SSG.COM | Blocked | `robots.txt` disallows generic `User-agent: *` at root during audit. | Use Shinsegae/SSG partner feed/API. |
| GS Shop | Blocked | `robots.txt` disallows generic `User-agent: *` at root during audit. | Use partner feed/API. |
| Hyundai Hmall | Blocked | `robots.txt` disallows generic `User-agent: *` at root during audit. | Use partner feed/API. |
| W Concept | Blocked | `robots.txt` disallows generic `User-agent: *` at root during audit. | Use partner feed/API. |
| Ably | Blocked | Robots/source probes returned HTTP 403 to the generic collector. | Use approved API/feed. |
| Zigzag | Needs source confirmation | Public paths appear allowed, but no product-level public sitemap/feed was confirmed. | Confirm approved product feed/API or public product sitemap before collection. |
| 29CM | Needs source confirmation | Public paths appear allowed, but no product-level public sitemap/feed was confirmed. | Confirm approved product feed/API or public product sitemap before collection. |
| Danawa | Needs source confirmation | Public paths appear partially allowed, but no product-level public sitemap/feed was confirmed. | Confirm approved product feed/API or public product sitemap before collection. |
| KREAM | Needs valid robots/source | A stable valid robots/source response was not confirmed during audit. | Confirm policy and approved feed/API before collection. |
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
| Sulwhasoo US, `https://us.sulwhasoo.com/robots.txt` | Shopify storefront allows public product/collection/page HTML. Private checkout/cart/account paths are restricted. UCP/MCP discovery is available. | `data/sulwhasoo-us-products.normalized.json` contains 115 public products. | Runtime collector implemented. 500 requires variants, bundles, additional locales, or partner feed. |
| Innisfree JP, `https://www.innisfree.jp/robots.txt` | Shopify storefront allows public product/collection/page HTML. Private checkout/cart/account paths are restricted. UCP/MCP discovery is available. | `data/innisfree-jp-products.normalized.json` contains 127 public products. | Runtime collector implemented. 500 requires variants, additional locales, or partner feed. |
| Kurly, `https://www.kurly.com/robots.txt` | Public goods paths and sitemap index were usable for the generic collector; private/account/order paths are not collected. | `data/kurly-products.normalized.json` contains 500 public products. | Runtime collector implemented. |
| StyleKorean, `https://www.stylekorean.com/robots.txt` | Generic `User-agent: *` allows public catalog/product access while blocking admin/plugin paths. | `data/stylekorean-products.normalized.json` contains 500 public products. | Runtime collector implemented. |

## Major Marketplace Audit On 2026-07-13

| Source | Result | Next action |
| --- | --- | --- |
| Coupang | HTTP 403 for generic robots/source probes. | Official partner API/feed only. |
| Musinsa | `robots.txt` blocks generic `User-agent: *` and allows only named bots/groups. | Partner API/feed or approved crawler identity. |
| Naver Shopping | Generic crawling blocked at root. | Official API/feed. |
| Gmarket / Auction | HTTP 403 to generic probes. | Approved API/feed. |
| 11st / SSG.COM / GS Shop / Hyundai Hmall / W Concept | Generic crawling blocked by robots policy. | Partner API/feed. |
| Zigzag / 29CM / Danawa | No confirmed product-level public sitemap/feed in quick audit. | Confirm approved feed or API before collection. |
| Ably | HTTP 403 to generic probes. | Approved API/feed. |
| KREAM | Stable valid robots/source not confirmed. | Confirm policy and approved source before collection. |

## V2 Acceptance Criteria

- Each merchant gets separate raw and normalized files:
  - `data/<merchant-id>-products.raw.json`
  - `data/<merchant-id>-products.normalized.json`
- Target is 500 products per merchant when source allows it.
- `data/merchant-collection-status.json` must record robots decisions and source notes.
- Image domains must be added to ChatGPT widget CSP before demo.
- No scraped checkout, cart, account, payment, review-report, or private API paths.
