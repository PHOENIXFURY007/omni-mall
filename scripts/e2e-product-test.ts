import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface Product {
  productId: string;
  title: string;
  merchantName: string;
  price: number;
  stockStatus: string;
}

interface ToolCallEnvelope<T> {
  structuredContent?: T;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a TCP port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
      lastError = new Error(`Health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError instanceof Error ? lastError : new Error("Health check timed out.");
}

async function jsonRpc<T>(baseUrl: string, id: number, method: string, params: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "accept": "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });

  assert.equal(response.ok, true, `MCP HTTP request failed with ${response.status}`);
  const body = await response.json() as JsonRpcResponse<T>;
  assert.equal(body.error, undefined, body.error?.message);
  assert.ok(body.result, `Missing JSON-RPC result for ${method}`);
  return body.result;
}

async function callTool<T>(baseUrl: string, id: number, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await callToolRaw<T>(baseUrl, id, name, args);
  assert.equal(result.isError, undefined, `${name} returned an error result`);
  assert.ok(result.structuredContent, `${name} returned no structured content`);
  return result.structuredContent;
}

async function callToolRaw<T>(baseUrl: string, id: number, name: string, args: Record<string, unknown>): Promise<ToolCallEnvelope<T>> {
  return await jsonRpc<ToolCallEnvelope<T>>(baseUrl, id, "tools/call", {
    name,
    arguments: args,
  });
}

function stopServer(server: ChildProcessWithoutNullStreams): void {
  if (server.exitCode !== null || server.killed) return;
  server.kill();
}

async function main(): Promise<void> {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["dist/src/server.js"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "pipe",
  });

  const stderrChunks: Buffer[] = [];
  server.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  try {
    await waitForHealth(baseUrl);

    const health = await fetch(`${baseUrl}/healthz`).then((response) => response.json()) as {
      ok: boolean;
      demoSurface: string;
      protocols: string[];
    };
    assert.equal(health.ok, true);
    assert.equal(health.demoSurface, "ChatGPT Apps SDK");
    assert.ok(health.protocols.includes("MCP"));
    assert.ok(health.protocols.includes("A2A"));

    const protectedResource = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`).then((response) => response.json()) as {
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    };
    assert.equal(protectedResource.resource, `${baseUrl}/mcp`);
    assert.ok(protectedResource.authorization_servers.includes(baseUrl));
    assert.ok(protectedResource.scopes_supported.includes("omnimall.checkout"));

    const authorizationServer = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`).then((response) => response.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
      code_challenge_methods_supported: string[];
    };
    assert.equal(authorizationServer.authorization_endpoint, `${baseUrl}/authorize`);
    assert.equal(authorizationServer.token_endpoint, `${baseUrl}/token`);
    assert.equal(authorizationServer.registration_endpoint, `${baseUrl}/register`);
    assert.ok(authorizationServer.code_challenge_methods_supported.includes("S256"));

    const clientRegistration = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "OmniMall E2E Test",
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        token_endpoint_auth_method: "none",
      }),
    });
    assert.equal(clientRegistration.status, 201);
    const registeredClient = await clientRegistration.json() as { client_id: string; redirect_uris: string[] };
    assert.ok(registeredClient.client_id.startsWith("chatgpt-"));
    assert.deepEqual(registeredClient.redirect_uris, ["https://chat.openai.com/aip/callback"]);

    const agentCard = await fetch(`${baseUrl}/.well-known/agent-card.json`).then((response) => response.json()) as {
      protocols: string[];
      providerCompatibility: string[];
    };
    assert.ok(agentCard.protocols.includes("mcp"));
    assert.ok(agentCard.protocols.includes("a2a"));
    assert.ok(agentCard.providerCompatibility.includes("OpenAI Agents SDK"));
    assert.ok(agentCard.providerCompatibility.includes("Claude Agent SDK"));
    assert.ok(agentCard.providerCompatibility.includes("Google ADK"));

    const toolsList = await jsonRpc<{ tools: Array<{ name: string }> }>(baseUrl, 1, "tools/list", {});
    const toolNames = toolsList.tools.map((tool) => tool.name);
    assert.deepEqual(toolNames.sort(), [
      "compare_products",
      "create_checkout_link",
      "explore_similar_products",
      "merchant_adapter_preview",
      "mcp_current_user",
      "search_products",
      "validate_merchant_mapping",
    ].sort());

    const search = await callTool<{
      type: "product_search";
      items: Product[];
      graph: unknown[];
      apiMeta: { demonstrationPlatform: string; protocols: string[] };
    }>(baseUrl, 2, "search_products", {
      query: "sensitive sunscreen under 30000",
      limit: 3,
      requireInStock: true,
    });
    assert.equal(search.type, "product_search");
    assert.ok(search.items.length > 0);
    assert.ok(search.items.every((product) => product.price <= 30000));
    assert.ok(search.items.every((product) => product.stockStatus === "in_stock"));
    assert.equal(search.apiMeta.demonstrationPlatform, "chatgpt_apps_sdk");
    assert.ok(search.apiMeta.protocols.includes("mcp"));
    assert.ok(search.apiMeta.protocols.includes("a2a"));

    const seed = search.items[0]!;
    const similar = await callTool<{
      type: "similar_products";
      seed: Product;
      items: Product[];
      graph: unknown[];
    }>(baseUrl, 3, "explore_similar_products", {
      productId: seed.productId,
      limit: 4,
    });
    assert.equal(similar.type, "similar_products");
    assert.equal(similar.seed.productId, seed.productId);
    assert.ok(similar.items.length > 0);
    assert.ok(similar.graph.length > 0);

    const compare = await callTool<{
      type: "product_comparison";
      products: Product[];
      comparisonRows: Array<{ label: string }>;
    }>(baseUrl, 4, "compare_products", {
      productIds: [seed.productId, similar.items[0]!.productId],
    });
    assert.equal(compare.type, "product_comparison");
    assert.equal(compare.products.length, 2);
    assert.ok(compare.comparisonRows.some((row) => row.label === "Price"));

    const checkoutPreview = await callToolRaw<{
      authenticated: boolean;
      authProvider: string;
      message: string;
    }>(baseUrl, 5, "create_checkout_link", {
      productId: seed.productId,
      confirmed: false,
    });
    assert.equal(checkoutPreview.isError, true);
    assert.equal(checkoutPreview.structuredContent?.authenticated, false);
    assert.equal(checkoutPreview.structuredContent?.authProvider, "google");
    assert.ok(Array.isArray(checkoutPreview._meta?.["mcp/www_authenticate"]));

    const currentUser = await callToolRaw<{
      authenticated: boolean;
      authProvider: string;
    }>(baseUrl, 6, "mcp_current_user", {});
    assert.equal(currentUser.isError, true);
    assert.equal(currentUser.structuredContent?.authenticated, false);
    assert.equal(currentUser.structuredContent?.authProvider, "google");

    const adapters = await callTool<{
      type: "merchant_adapter_preview";
      coverage: { merchantCount: number; sampleProductCount: number };
      merchants: unknown[];
    }>(baseUrl, 7, "merchant_adapter_preview", {});
    assert.equal(adapters.type, "merchant_adapter_preview");
    assert.equal(adapters.coverage.merchantCount, 10);
    assert.ok(adapters.coverage.sampleProductCount >= 10);
    assert.equal(adapters.merchants.length, 10);

    const validation = await callTool<{
      type: "merchant_mapping_validation";
      results: Array<{ ok: boolean; score: number }>;
    }>(baseUrl, 8, "validate_merchant_mapping", {});
    assert.equal(validation.type, "merchant_mapping_validation");
    assert.ok(validation.results.every((result) => result.ok));
    assert.ok(validation.results.every((result) => result.score >= 80));

    console.log(`OmniMall E2E product test passed on ${baseUrl}`);
  } catch (error) {
    const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
    if (stderr) console.error(stderr);
    throw error;
  } finally {
    stopServer(server);
  }
}

await main();
