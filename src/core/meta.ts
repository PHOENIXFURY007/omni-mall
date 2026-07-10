import type { AccessClass, AuthMode, ToolApiMeta } from "../types.js";

export const P95_TARGET_MS = 2000;

export function createApiMeta(accessClass: AccessClass, authMode: AuthMode = "none"): ToolApiMeta {
  return {
    demonstrationPlatform: "chatgpt_apps_sdk",
    compatibleProviders: ["openai_agents_sdk", "claude_agent_sdk", "google_adk"],
    protocols: ["mcp", "a2a"],
    p95TargetMs: P95_TARGET_MS,
    authMode,
    accessClass,
    generatedAt: new Date().toISOString(),
  };
}
