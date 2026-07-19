# OmniMall ChatGPT Demo Runbook

Use this runbook for a screen recording that proves OmniMall works end to end in ChatGPT.

## 1. Pre-Recording Safety

- Close the `.env` tab before recording. It contains OAuth secrets and should not appear on screen.
- Keep one terminal for the OmniMall server and one terminal for ngrok.
- Use the public HTTPS `/mcp` URL in ChatGPT. ChatGPT cannot connect to `127.0.0.1` directly.

## 2. Run OmniMall Locally

From PowerShell:

```powershell
cd C:\Users\SDS\workspace\omni-mall
$env:Path='C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
& 'C:\Program Files\nodejs\npm.cmd' run start
```

Expected local health check:

```text
http://127.0.0.1:8787/healthz
```

The current verified public tunnel in this workspace is:

```text
https://0562-1-233-113-242.ngrok-free.app/mcp
```

If ngrok restarts and gives a new URL, update these before recording:

- `.env` `PUBLIC_BASE_URL`
- `.env` `GOOGLE_REDIRECT_URI`
- Google Cloud OAuth authorized redirect URI: `https://<new-ngrok-domain>/callback`
- ChatGPT developer-mode app MCP URL: `https://<new-ngrok-domain>/mcp`

## 3. Keep Or Start Ngrok

If the tunnel is not already running:

```powershell
ngrok http 8787
```

Verify:

```text
https://<ngrok-domain>/healthz
https://<ngrok-domain>/.well-known/oauth-protected-resource/mcp
```

## 4. Connect In ChatGPT

1. In ChatGPT, enable Developer mode from Settings > Security and login.
2. Open Settings > Plugins, or go to `https://chatgpt.com/plugins`.
3. Create a developer-mode app.
4. Use:
   - Name: `OmniMall`
   - Description: `Cross-merchant shopping search, similar-product graph, comparison, merchant adapter validation, and checkout handoff.`
   - MCP server URL: `https://0562-1-233-113-242.ngrok-free.app/mcp`
5. Create or refresh the app so ChatGPT scans the current tools.
6. Start a new chat, click `+` near the composer, choose More, and select OmniMall.

If `OmniMall v2` already appears in the ChatGPT tools/apps list, select that app instead of creating a duplicate.

## 5. Quick Verification Commands

Run these before recording:

```powershell
cd C:\Users\SDS\workspace\omni-mall
$env:Path='C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run smoke
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e
```

Expected:

```text
OmniMall smoke test passed
OmniMall E2E product test passed
```

## 6. Screen Recording Storyboard

1. Show `healthz` in the browser to prove the server is alive.
2. Show ChatGPT with OmniMall selected.
3. Run cross-merchant search.
4. Show product cards with images, merchants, prices, stock, and result explanation.
5. Click a product card's graph/similar action, or prompt for graph exploration.
6. Show the graph UI with product image nodes and relation edges.
7. Ask for comparison of three products.
8. Ask for checkout and show the Google OAuth protection step.
9. Ask for current signed-in user after auth, if login is completed.
10. Run adapter preview and mapping validation to prove system structure, not just prompt output.

## 7. Golden Demo Prompts

### Search

```text
Use OmniMall to search for in-stock sensitive sunscreen under 30000 KRW across multiple merchants. Show product cards with merchant, price, stock status, and why each result matched.
```

Expected proof points:

- Multiple merchants such as StyleKorean, Olive Young, Innisfree JP, Sulwhasoo US, Kurly, or Amore Pacific.
- Product images appear in the ChatGPT widget.
- Prices respect the 30000 KRW constraint.

### Graph Exploration

```text
Use the best sunscreen result as the seed product and show similar, substitute, and complementary products as a graph. Briefly explain the strongest graph edges.
```

Expected proof points:

- Graph UI renders product images as nodes.
- Relation labels include similar, substitute, or complement.
- Edge weights/reasons are visible or summarized.

### Compare

```text
Compare the top 3 sunscreen products from the previous OmniMall results. Make a concise recommendation for sensitive skin under 30000 KRW.
```

Expected proof points:

- Comparison table appears.
- Rows include price, merchant, category, rating/review signal, stock, tags, and metadata quality.
- ChatGPT recommends one product based on structured tool results.

### Checkout Auth

```text
Create a checkout link for the recommended product. I confirm that OmniMall may hand me off to the external merchant checkout or product page.
```

Expected proof points:

- If not signed in, ChatGPT shows the Google OAuth/access step.
- After successful sign-in, the protected checkout tool can return an external handoff URL.
- This demonstrates confirmation-first checkout plus OAuth-gated action.

### Current User

```text
Use OmniMall to tell me who I am currently signed in as.
```

Expected proof points:

- If authenticated, it returns the Google user identity.
- If not authenticated, it correctly requests Google login.

### Adapter Coverage

```text
Use OmniMall to preview merchant adapter coverage. Show each merchant, its capabilities, auth mode, and catalog coverage.
```

Expected proof points:

- Merchant count should be 10.
- Domains include beauty, digital/electronics, fashion, food, kids, and living.
- This proves the app normalizes multiple merchants behind one schema.

### Mapping Validation

```text
Use OmniMall to validate all merchant mappings. Show validation score, missing fields if any, and onboarding estimate for each merchant.
```

Expected proof points:

- All current merchants should validate as OK.
- Scores should be visible.
- This proves schema quality control for new merchant onboarding.

### Zero-Result Fallback

```text
Use the OmniMall search_products tool with query "nonexistent-specialized-query", merchantIds ["daiso"], domain "digital", and limit 5. Show whether zero-result fallback occurred and explain the fallback results.
```

Expected proof points:

- `zeroResult.occurred` should be true.
- The app still returns fallback alternatives instead of a dead end.

## 8. What To Say While Recording

Short narration script:

```text
This is OmniMall, a ChatGPT Apps SDK and MCP based cross-merchant shopping PoC. The server exposes product search, graph recommendation, comparison, checkout handoff, current-user auth, adapter preview, and mapping validation tools. Public discovery tools work as a guest, while checkout and current-user actions are protected through Google OAuth. The widget shows structured product cards, graph nodes, comparison rows, and validation output, so the demo is not only text generation.
```

