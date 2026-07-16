# OmniMall Implementation Runbook

## What This Implements

This PoC implements the first executable OmniMall slice from `plan_v1.md`:

- ChatGPT Apps SDK style MCP server over Streamable HTTP.
- In-memory normalized product catalog across Shinsegae, Lotte, Olive Young, Daiso, and Amore Pacific.
- General shopping domain support, not merchant-limited or beauty-only.
- Hybrid search using tokens, attributes, merchant intent, stock, metadata quality, and graph signals.
- Similar product graph exploration across merchants.
- Product comparison.
- External checkout handoff with confirmation gating and Google OAuth gating at the MCP tool layer.
- Merchant adapter preview and mapping validation.
- Provider-neutral metadata for OpenAI Agents SDK, Claude Agent SDK, and Google ADK.
- A2A discovery stub through an agent card endpoint.

## Commands

Use a normal Node.js 22+ installation:

```bash
npm install
npm run build
npm test
npm run smoke
npm run dev
```

In this workspace, a portable Node runtime was placed under `.tools/` because `node` and `npm` were not on PATH.

## Local Endpoints

Default server:

```text
http://127.0.0.1:8787
```

Useful endpoints:

```text
GET  /
GET  /healthz
GET  /.well-known/agent-card.json
GET  /a2a/agent-card
GET  /.well-known/oauth-protected-resource/mcp
GET  /.well-known/oauth-authorization-server
GET  /.well-known/openid-configuration
POST /register
GET  /authorize
POST /token
GET  /callback
GET  /jwks
GET  /userinfo
POST /mcp
GET  /mcp with Accept: text/event-stream
```

## Google OAuth

OmniMall now exposes MCP OAuth 2.1 metadata and implements a Google OAuth/OIDC-backed authorization flow.

Public tools remain usable without login:

- `search_products`
- `explore_similar_products`
- `compare_products`
- `merchant_adapter_preview`
- `validate_merchant_mapping`

OAuth-gated tools:

- `create_checkout_link`
- `mcp_current_user`

Required server environment for real Google login:

```powershell
$env:PUBLIC_BASE_URL='https://<public-ngrok-or-domain>'
$env:GOOGLE_CLIENT_ID='<google-oauth-client-id>'
$env:GOOGLE_CLIENT_SECRET='<google-oauth-client-secret>'
$env:GOOGLE_REDIRECT_URI='https://<public-ngrok-or-domain>/callback'
# Optional comma-separated allowlist, for example:
$env:GOOGLE_ALLOWED_EMAIL_DOMAINS='gmail.com,company.com'
```

Google Cloud Console must register the exact redirect URI above. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, metadata and dynamic client registration work, but `/authorize` returns an OAuth `server_error` back to the client.

Runtime-generated OAuth files are ignored and must not be committed:

- `data/oauth-clients.json`
- `data/oauth-jwt-private-key.pem`

## MCP Tools

- `search_products`
- `explore_similar_products`
- `compare_products`
- `create_checkout_link`
- `mcp_current_user`
- `merchant_adapter_preview`
- `validate_merchant_mapping`

## Widget

The widget resource is:

```text
ui://widget/omni-mall-products.html
```

It renders product cards, comparison tables, graph signals, adapter cards, validation output, and checkout handoff state.

## Future Work

The current implementation is a PoC slice, not the full production build. Next phases should add:

- Real merchant API/feed adapters.
- Merchant-specific OAuth/API-token checkout and cart APIs.
- Persistent catalog, vector index, and graph store.
- Audit log persistence for checkout/order actions.
- Provider-specific adapters for Claude Agent SDK and Google ADK.
- Offline evaluation set and ranking metrics dashboard.
