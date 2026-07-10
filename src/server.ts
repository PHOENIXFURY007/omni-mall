import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerOmniMallTools } from "./mcp/tools.js";
import { registerWidgetResources } from "./mcp/resources.js";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";
const SERVICE_NAME = "omni-mall-agentic-shopping";
const VERSION = "0.1.0";

function originFromRequest(req: IncomingMessage): string {
  const host = req.headers.host ?? `${HOST}:${PORT}`;
  const protocol = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0]?.trim() || "http";
  return `${protocol}://${host}`;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function setMcpCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function isMcpMethod(method: string | undefined): boolean {
  return new Set(["POST", "GET", "DELETE"]).has(method ?? "");
}

function acceptsEventStream(req: IncomingMessage): boolean {
  return String(req.headers.accept ?? "").includes("text/event-stream");
}

function createOmniMallServer(appOrigin: string): McpServer {
  const server = new McpServer({
    name: SERVICE_NAME,
    version: VERSION,
  });
  registerWidgetResources(server, appOrigin);
  registerOmniMallTools(server);
  return server;
}

function agentCard(baseUrl: string): Record<string, unknown> {
  return {
    name: "OmniMall Shopping Agent",
    version: VERSION,
    description: "Cross-merchant product search, graph recommendations, comparison, adapter validation, and checkout handoff.",
    preferredDemoSurface: "ChatGPT Apps SDK",
    protocols: ["mcp", "a2a"],
    providerCompatibility: ["OpenAI Agents SDK", "Claude Agent SDK", "Google ADK"],
    endpoints: {
      mcp: `${baseUrl}${MCP_PATH}`,
      health: `${baseUrl}/healthz`,
      agentCard: `${baseUrl}/.well-known/agent-card.json`,
    },
    skills: [
      "search_products",
      "explore_similar_products",
      "compare_products",
      "create_checkout_link",
      "merchant_adapter_preview",
      "validate_merchant_mapping",
    ],
    auth: {
      pocMode: "public sample catalog",
      planned: ["OAuth 2.1 / PKCE", "session-bound OAuth", "merchant API tokens", "audit logging"],
    },
  };
}

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: "Missing URL" });
    return;
  }

  const url = new URL(req.url, originFromRequest(req));
  const appOrigin = originFromRequest(req);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/") {
    sendJson(res, 200, {
      ok: true,
      service: SERVICE_NAME,
      version: VERSION,
      mcpPath: MCP_PATH,
      demoSurface: "ChatGPT Apps SDK",
      note: "Use /mcp for Streamable HTTP MCP requests.",
    });
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      service: SERVICE_NAME,
      version: VERSION,
      mcpPath: MCP_PATH,
      demoSurface: "ChatGPT Apps SDK",
      providers: ["OpenAI Agents SDK", "Claude Agent SDK", "Google ADK"],
      protocols: ["MCP", "A2A"],
    });
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/.well-known/agent-card.json" || url.pathname === "/a2a/agent-card")) {
    sendJson(res, 200, agentCard(appOrigin));
    return;
  }

  if (url.pathname === MCP_PATH && (req.method === "GET" || req.method === "HEAD") && !acceptsEventStream(req)) {
    sendJson(res, 200, {
      ok: true,
      service: SERVICE_NAME,
      transport: "streamable-http",
      endpoint: `${appOrigin}${MCP_PATH}`,
      note: "Use POST for JSON-RPC. GET streaming requires Accept: text/event-stream.",
    });
    return;
  }

  if (url.pathname === MCP_PATH && isMcpMethod(req.method)) {
    setMcpCors(res);
    const mcpServer = createOmniMallServer(appOrigin);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error: unknown) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      }
      res.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "mcp request failed",
      }));
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`${SERVICE_NAME} listening on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}${MCP_PATH}`);
});
