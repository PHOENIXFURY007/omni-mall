# OmniMall Development Plan v1
결과보고서항목소개
1
제안서의현업문제정의
제안서내용기재
2
제안서대비달성현황
제안서에목표한내용대비달성내역
미달성/변경초과달성항목명시
3
과제수행결과
문제해결성과중심으로서술
상세한시스템설명은다음장에기재
4
과제시스템설명
주요기능및AI 기술설명
성능개선포인트, 동작하는화면
5
시스템구조설명
블록다이어그램
주요구성요소, 외부연계포함전체흐름설명
6
소스코드설명
파일·디렉토리역할안내
주요모듈·패키지역할설명
Date: 2026-07-08

This document is the working instruction plan for future Codex development of OmniMall. It refines the README proposal and should be read before implementation work begins.

No application code is defined in this document. It is an architecture, planning, and execution guide.

## Objective

Build OmniMall as a universal agentic commerce platform.

OmniMall must not be limited to Olive Young, Daiso, Lotte, or Amore Pacific. Those merchants are only possible pilot examples. The platform must support Shinsegae, Lotte, Olive Young, Daiso, Amore Pacific, and future merchants through a common product schema and merchant adapter framework.

The product goal is:

- Universal shopping search and recommendation across heterogeneous merchants.
- Product comparison and similar-product graph exploration.
- Cart and checkout handoff through merchant-approved links or APIs.
- Provider-neutral agent support for OpenAI, Anthropic/Claude, and Google/Gemini.
- MCP for tool and data access.
- A2A for agent-to-agent collaboration.
- OAuth and service authentication for user, admin, merchant, and agent workflows.

## AI Professional Alignment

The implementation must satisfy the AI Professional 과제심사형 기준 from the README.

The core evaluation story is:

- Problem: merchant schema differences, manual onboarding, weak search quality, zero-result queries, weak similar-product navigation, and checkout linkage gaps.
- Solution: common product schema, merchant adapters, hybrid search, product graph, MCP tools, A2A agent collaboration, OAuth-secured commerce actions, and widget UI.
- Evidence: measurable improvements in onboarding time, Top-3 conversion, cart creation, checkout entry, product attribute completeness, adapter validation failure rate, zero-result rate, and P95 latency.

Avoid the restricted patterns in the README:

- Do not make this a simple prompt-only AI wrapper.
- Do not rely on no-code tooling as the result.
- Do not submit a single open-source project unchanged.
- Reuse `olive-poc` and `shinsegae-tableau-chatgpt` only as references and reusable patterns, not as the final product identity.

## Reference Repositories

Use these existing local repositories as implementation references:

- `C:\Users\SDS\workspace\olive-poc`
- `C:\Users\SDS\workspace\shinsegae-tableau-chatgpt`

Use `olive-poc` for:

- Commerce MCP tool patterns.
- Product and routine search contracts.
- Widget rendering patterns.
- Catalog API separation.
- Product image proxying.
- Kubernetes and ArgoCD deployment draft structure.

Use `shinsegae-tableau-chatgpt` for:

- Production MCP server structure.
- OAuth and Entra authentication pattern.
- User authorization mapping.
- Audit logging.
- Result contract enforcement.
- CSV/download link patterns.
- Deployment, smoke test, and enterprise readiness discipline.

## Target Architecture

OmniMall should be organized conceptually as:

```text
User Channels
  -> ChatGPT App Widget
  -> Claude Agent
  -> Gemini / Google ADK Agent
  -> Optional Web Frontend

Agent Runtime Layer
  -> OpenAI Agents SDK Adapter
  -> Claude Agent SDK Adapter
  -> Google ADK Adapter

Protocol Layer
  -> MCP Server
  -> A2A Server
  -> A2A Client
  -> REST API fallback

OmniMall Core
  -> Intent classification
  -> Attribute extraction
  -> Hybrid product search
  -> Product graph ranking
  -> Product comparison
  -> Cart and checkout handoff
  -> Audit logs and metrics

Merchant Adapter Layer
  -> Shinsegae Adapter
  -> Lotte Adapter
  -> Olive Young Adapter
  -> Daiso Adapter
  -> Amore Pacific Adapter
  -> Future Merchant Adapters

Data Layer
  -> Common product catalog
  -> Merchant mapping specs
  -> Vector index
  -> Product graph
  -> Price and stock cache
  -> Search logs
  -> Conversion and evaluation logs
```

## Design Principles

The commerce logic must live in OmniMall Core, not inside individual SDK implementations.

Bad direction:

- Separate OpenAI search logic.
- Separate Claude search logic.
- Separate Gemini search logic.

Correct direction:

- One common search, ranking, graph, adapter, cart, and checkout core.
- Multiple SDK adapters call the same core through MCP, A2A, or internal service APIs.

MCP and A2A have different roles:

- MCP is for exposing tools, resources, prompts, and commerce data to agents.
- A2A is for agent-to-agent discovery, delegation, collaboration, and task exchange.

## Frontend Plan

OmniMall does need a frontend, but the first frontend should be a ChatGPT App widget, not a full standalone ecommerce website.

MVP frontend:

- Product result cards.
- Similar-product graph exploration.
- Product comparison.
- Cart preview.
- Checkout handoff buttons.
- Merchant/source badges.
- Missing price, missing stock, or checkout-unavailable explanations.

Later frontend:

- Admin dashboard for merchant onboarding.
- Adapter validation reports.
- Search quality metrics.
- Zero-result query analysis.
- Conversion funnel dashboard.

Do not prioritize a full public shopping mall website until the agentic commerce flow is validated.

## PoC Demonstration Strategy

The PoC demonstration platform should be ChatGPT Apps SDK with an MCP-backed widget UI.

Rationale:

- The README proposal is already framed around ChatGPT Apps SDK and MCP.
- `olive-poc` already provides relevant MCP and widget patterns.
- `shinsegae-tableau-chatgpt` already provides relevant production MCP, OAuth, Entra, audit, and deployment patterns.
- A ChatGPT widget is enough to demonstrate product cards, similar-product graph exploration, comparison, cart preview, checkout handoff, and adapter preview.
- Demonstrating ChatGPT, Claude, and Gemini equally in the first PoC would increase scope without improving the AI Professional evidence as much as a complete end-to-end ChatGPT demo.

For PoC scope:

- Primary live demo: ChatGPT App widget + OmniMall MCP server.
- Secondary proof: architecture and optional smoke checks showing that the OmniMall Core is provider-neutral.
- Later expansion: Claude Agent SDK and Google ADK adapters using the same MCP/A2A/core services.

Do not build a separate standalone frontend for the PoC unless the user explicitly asks for it. A separate frontend becomes useful later for admin operations, merchant onboarding, analytics, or a public shopping surface outside ChatGPT.

## Agent SDK Support

Support all three agent SDK families through adapters:

| SDK | Role |
| --- | --- |
| OpenAI Agents SDK | Primary OpenAI/ChatGPT agent runtime, MCP tools, handoffs, guardrails |
| Claude Agent SDK | Claude-based runtime using the same OmniMall MCP tools and permission model |
| Google ADK | Gemini/Vertex multi-agent runtime, strong fit for A2A server/client workflows |

The SDK adapters should normalize input and output around a provider-neutral internal request format:

- user message
- locale
- channel
- user identity
- allowed tools
- shopping intent
- extracted constraints
- safety and checkout policy
- trace and audit metadata

## Authentication And Authorization

OAuth is part of the product plan.

Support these auth modes:

| Auth Mode | Purpose |
| --- | --- |
| Guest mode | Product search, comparison, non-personal recommendations |
| OIDC/OAuth user login | Saved cart, preferences, checkout handoff, personalized recommendations |
| Entra ID | Enterprise/admin users and Shinsegae internal demo flow |
| Google OAuth | Consumer login and Google/Gemini ecosystem alignment |
| Kakao/Naver OAuth | Korean consumer login expansion |
| Merchant OAuth/API key | Merchant-specific APIs for catalog, price, stock, cart, order, or checkout |
| OAuth client credentials | Service-to-service and partner system access |
| Signed JWT service token | A2A service identity and internal calls |
| Optional mTLS | Enterprise/internal agent-to-agent security |

Initial implementation should prefer:

- Entra OAuth pattern from `shinsegae-tableau-chatgpt`.
- Public guest tools for low-risk search.
- OAuth-required tools for cart, checkout, and personalization.
- Admin-required tools for adapter validation and operational analytics.

Tool access classes:

- Public tools: search products, explore similar products, compare products.
- User OAuth tools: create cart, add to cart, save preference, create checkout link.
- Admin tools: merchant adapter preview, validate mapping, export logs, inspect metrics.
- Service tools: A2A delegation, merchant API refresh, index rebuild, graph refresh.

## Core MCP Tools

Target MCP tools should include:

- `search_products`
- `explore_similar_products`
- `compare_products`
- `recommend_bundle`
- `get_product_detail`
- `get_price_stock`
- `create_cart`
- `add_to_cart`
- `create_checkout_link`
- `merchant_adapter_preview`
- `validate_merchant_mapping`
- `get_search_metrics`
- `export_search_logs`

During MVP, keep the tool list small:

- `search_products`
- `explore_similar_products`
- `compare_products`
- `create_checkout_link`
- `merchant_adapter_preview`
- `validate_merchant_mapping`

## A2A Agent Roles

Expose OmniMall as an A2A agent so other agents can ask it to perform shopping tasks.

Also allow OmniMall to call other A2A agents:

- Merchant catalog agent.
- Merchant stock agent.
- Promotion/coupon agent.
- Checkout agent.
- Customer support agent.
- Compliance/policy agent.

A2A task outputs should return structured artifacts:

- product candidates
- stock status
- price quote
- promotion eligibility
- checkout link
- unavailable reason
- audit reference

## Common Product Schema

The common product schema should normalize merchant differences.

Required concept groups:

- merchant identity
- product identity
- SKU and variant identity
- title/name
- brand
- category path
- normalized attributes
- images
- product URL
- price and currency
- discount/promotion
- stock status
- delivery information
- rating/review summary
- tags
- ingredients/materials/specs when available
- checkout URL or checkout eligibility
- metadata quality score
- source timestamp

The schema must support multiple domains, not only beauty:

- fashion
- grocery
- beauty
- electronics
- home/living
- department store goods
- food and beverage
- baby/kids
- luxury
- services or experience products if merchant data allows

## Merchant Adapter Framework

Each merchant adapter should handle:

- input source parsing
- merchant API calls or feed ingestion
- field mapping to common schema
- category normalization
- attribute normalization
- price and stock refresh
- checkout link generation or handoff
- adapter validation
- mapping quality report
- error and fallback handling

Onboarding target:

- Current pain: one week or more per merchant.
- Target: one day or less for a new merchant with a clear API/feed/spec.

## Search And Ranking

Search must be hybrid, not keyword-only.

Ranking signals:

- keyword match
- embedding similarity
- category and attribute match
- product graph proximity
- stock availability
- price fit
- merchant trust/quality
- popularity or conversion signal
- metadata completeness
- user preference when authenticated
- reranker score in later phases

Zero-result handling:

- synonym expansion
- typo normalization
- category fallback
- cross-merchant substitute search
- attribute relaxation
- explanation when no result is safe to show

## Product Graph

Graph edges should support:

- similar products
- substitutes
- complementary products
- same category
- same brand
- same ingredient/material/spec
- same price band
- same user intent
- frequently compared together
- frequently bought together when available

Graph must be explainable in UI:

- why this product is similar
- what changed from the original product
- price difference
- merchant difference
- stock difference
- key attribute difference

## Checkout Strategy

MVP checkout should use external merchant checkout links or product-detail handoff links.

Do not attempt full payment/order ownership in MVP unless merchant APIs and compliance approval are available.

Checkout stages:

1. Product detail link.
2. External checkout link with signed session metadata if available.
3. Merchant cart API integration.
4. Future agentic commerce protocol or merchant-native checkout API integration.

Every checkout action must:

- require explicit user confirmation.
- log an audit event.
- show merchant, price, stock, and checkout eligibility.
- explain if checkout cannot be created.

## Metrics And Evaluation

Primary KPIs:

- Top-3 conversion rate.
- Cart creation rate.
- Checkout entry rate.
- Zero-result rate.
- Search click-through rate.
- New merchant onboarding time.
- Product attribute missing rate.
- Adapter validation failure rate.
- P95 latency.

Quality evaluation:

- Build an offline evaluation set from search logs.
- Track query-to-product relevance.
- Track graph recommendation usefulness.
- Track zero-result recovery.
- Tune hybrid weights and reranker from evaluation results.

Operational reports:

- Adapter mapping QA report.
- Metadata completeness report.
- Merchant coverage report.
- Search latency report.
- Error and fallback report.
- Admin audit report.

## Development Phases

### Phase 0: Planning And Repo Setup

- Keep this document as the active development plan.
- Do not implement until the target MVP scope is selected.
- Confirm whether `omni-mall` will be the primary repo for new work.
- Confirm whether the first runtime is Node/TypeScript, Python, or mixed.
- Treat ChatGPT Apps SDK as the PoC demonstration channel unless the user explicitly changes the demo target.

Recommended default:

- Node/TypeScript for MCP/App/widget server patterns.
- Python services only where search/indexing/evaluation benefits from Python tooling.

### Phase 1: MVP Core

- Define common product schema.
- Define merchant adapter interface.
- Build one pilot adapter.
- Build lexical product search.
- Build basic product detail and comparison response.
- Build MCP server with a minimal public tool set.
- Build ChatGPT widget for product cards and comparison.
- Demonstrate the first end-to-end user flow inside ChatGPT, not in a separate public ecommerce frontend.

Recommended pilot:

- Start with Shinsegae if product data/API access exists.
- Otherwise start with existing Olive POC data to prove the flow, while keeping naming universal.

### Phase 2: OAuth And Authorization

- Add Entra/OIDC authentication pattern.
- Split tools into public, user-authenticated, admin, and service scopes.
- Add audit logging.
- Add user identity and authorization mapping.

### Phase 3: Hybrid Search And Graph

- Add embedding index.
- Add product graph.
- Add graph-based similar-product exploration.
- Add zero-result recovery.
- Add basic reranking.

### Phase 4: Multi-Merchant Expansion

- Add at least two more merchant adapters.
- Add adapter validator.
- Add mapping QA reports.
- Add metadata completeness scoring.
- Measure onboarding time.

### Phase 5: Multi-SDK Agent Runtime

- Add OpenAI Agents SDK adapter.
- Add Claude Agent SDK adapter.
- Add Google ADK adapter.
- Keep all SDKs calling the same OmniMall tools and core services.
- For PoC evidence, document Claude and Google ADK compatibility as architecture-supported unless a later milestone explicitly requires live demos on all three platforms.

### Phase 6: A2A Integration

- Expose OmniMall as an A2A agent.
- Add A2A client support for external merchant/specialist agents.
- Define agent cards, skills, task artifacts, and service auth.

### Phase 7: Admin And Evaluation

- Build admin/operator dashboard or report endpoints.
- Add search log evaluation loop.
- Add adapter QA dashboard.
- Add KPI reporting for AI Professional evidence.

## Acceptance Criteria For MVP

MVP is acceptable only if it demonstrates:

- At least one merchant adapter working through the common schema.
- MCP search tool returning normalized products.
- Product cards visible in ChatGPT widget.
- Similar-product or comparison flow.
- Checkout handoff link or explicit unavailable reason.
- Basic audit/search logging.
- P95 latency measurement.
- Clear separation between OmniMall Core and SDK/provider adapters.
- Clear statement that ChatGPT is the primary PoC demo surface and Claude/Gemini are supported through provider-neutral architecture.

## AI Professional Evidence Package

When preparing the final submission, collect:

- Architecture diagram.
- Data flow diagram.
- Common schema explanation.
- Merchant adapter validation report.
- Search and ranking method explanation.
- Product graph explanation.
- OAuth/security explanation.
- Demo screenshots or recordings.
- KPI before/after or baseline/target table.
- Search quality evaluation samples.
- Zero-result recovery examples.
- Latency report.
- Limitations and next-step plan.

## Codex Implementation Instructions

Before making code changes, Codex should:

1. Read `README.md`.
2. Read this `plan_v1.md`.
3. Inspect `olive-poc` for reusable commerce MCP/widget/catalog patterns.
4. Inspect `shinsegae-tableau-chatgpt` for OAuth, MCP server, audit, and production patterns.
5. Confirm the immediate phase with the user if the request is ambiguous.
6. Keep changes scoped to OmniMall unless explicitly asked otherwise.
7. Do not copy large code structures blindly from reference repos.
8. Preserve the universal commerce framing.
9. Keep MCP/A2A/provider SDK boundaries clean.
10. Add tests and validation proportional to risk when implementation begins.

If implementation begins, Codex should update this document or a follow-up plan when major architecture decisions change.
