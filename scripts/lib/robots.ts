export const DEFAULT_COLLECTOR_USER_AGENT =
  process.env.OMNIMALL_COLLECTOR_USER_AGENT
  ?? "OmniMall-PoC-Collector/0.1 (+public catalog collection)";

export interface RobotsSource {
  id: string;
  displayName: string;
  baseUrl: string;
  samplePaths: string[];
  notes?: string[];
}

export interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
  line: number;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay?: number;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export interface RobotsPathDecision {
  path: string;
  allowed: boolean;
  userAgent: string;
  matchedAgents: string[];
  matchedRule?: RobotsRule;
  crawlDelay?: number;
}

export interface RobotsAuditResult {
  id: string;
  displayName: string;
  baseUrl: string;
  robotsUrl: string;
  fetchedAt: string;
  ok: boolean;
  status?: number;
  error?: string;
  isRobotsText: boolean;
  sitemaps: string[];
  decisions: RobotsPathDecision[];
  notes: string[];
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf("#");
  return (hashIndex >= 0 ? line.slice(0, hashIndex) : line).trim();
}

export function parseRobots(content: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let crawlDelay: number | undefined;
  let hasDirective = false;

  function flushGroup(): void {
    if (!agents.length) return;
    groups.push({ agents, rules, crawlDelay });
    agents = [];
    rules = [];
    crawlDelay = undefined;
    hasDirective = false;
  }

  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = stripComment(rawLine);
    if (!line) return;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) return;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "user-agent") {
      if (agents.length && hasDirective) flushGroup();
      agents.push(value.toLowerCase());
      return;
    }

    if (key === "sitemap") {
      sitemaps.push(value);
      return;
    }

    if (!agents.length) return;
    hasDirective = true;

    if (key === "allow" || key === "disallow") {
      rules.push({
        type: key,
        pattern: value,
        line: index + 1,
      });
      return;
    }

    if (key === "crawl-delay") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) crawlDelay = parsed;
    }
  });

  flushGroup();
  return { groups, sitemaps };
}

function agentMatchScore(agent: string, userAgent: string): number {
  if (agent === "*") return 1;
  return userAgent.toLowerCase().includes(agent.toLowerCase()) ? agent.length + 1 : 0;
}

function selectGroup(parsed: ParsedRobots, userAgent: string): RobotsGroup | undefined {
  let selected: RobotsGroup | undefined;
  let selectedScore = 0;

  for (const group of parsed.groups) {
    const score = Math.max(...group.agents.map((agent) => agentMatchScore(agent, userAgent)), 0);
    if (score > selectedScore) {
      selected = group;
      selectedScore = score;
    }
  }

  return selected;
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function ruleMatches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(`^${escapeRegex(body).replace(/\*/g, ".*")}${anchored ? "$" : ""}`);
  return regex.test(path);
}

function ruleSpecificity(rule: RobotsRule): number {
  return rule.pattern.replace(/\*/g, "").replace(/\$/g, "").length;
}

export function evaluateRobots(parsed: ParsedRobots, path: string, userAgent = DEFAULT_COLLECTOR_USER_AGENT): RobotsPathDecision {
  const group = selectGroup(parsed, userAgent);
  if (!group) {
    return {
      path,
      allowed: true,
      userAgent,
      matchedAgents: [],
    };
  }

  const matchedRules = group.rules
    .filter((rule) => ruleMatches(rule.pattern, path))
    .sort((left, right) => {
      const specificityDelta = ruleSpecificity(right) - ruleSpecificity(left);
      if (specificityDelta !== 0) return specificityDelta;
      if (left.type === right.type) return 0;
      return left.type === "allow" ? -1 : 1;
    });

  const matchedRule = matchedRules[0];
  const allowed = matchedRule ? matchedRule.type === "allow" : true;

  return {
    path,
    allowed,
    userAgent,
    matchedAgents: group.agents,
    matchedRule,
    crawlDelay: group.crawlDelay,
  };
}

export async function auditRobotsSource(source: RobotsSource, userAgent = DEFAULT_COLLECTOR_USER_AGENT): Promise<RobotsAuditResult> {
  const robotsUrl = new URL("/robots.txt", source.baseUrl).toString();
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(robotsUrl, {
      headers: {
        "user-agent": userAgent,
        "accept": "text/plain,*/*;q=0.8",
      },
    });
    const text = await response.text();
    const isRobotsText = response.ok && /user-agent\s*:/i.test(text) && !/^\s*<!doctype html/i.test(text);

    if (!response.ok || !isRobotsText) {
      return {
        id: source.id,
        displayName: source.displayName,
        baseUrl: source.baseUrl,
        robotsUrl,
        fetchedAt,
        ok: false,
        status: response.status,
        isRobotsText,
        sitemaps: [],
        decisions: [],
        notes: [
          ...(source.notes ?? []),
          response.ok ? "robots.txt did not look like a valid robots file." : `robots.txt returned HTTP ${response.status}.`,
        ],
      };
    }

    const parsed = parseRobots(text);
    const decisions = source.samplePaths.map((path) => evaluateRobots(parsed, path, userAgent));

    return {
      id: source.id,
      displayName: source.displayName,
      baseUrl: source.baseUrl,
      robotsUrl,
      fetchedAt,
      ok: true,
      status: response.status,
      isRobotsText,
      sitemaps: parsed.sitemaps,
      decisions,
      notes: source.notes ?? [],
    };
  } catch (error) {
    return {
      id: source.id,
      displayName: source.displayName,
      baseUrl: source.baseUrl,
      robotsUrl,
      fetchedAt,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      isRobotsText: false,
      sitemaps: [],
      decisions: [],
      notes: source.notes ?? [],
    };
  }
}

export async function requireRobotsAllowed(source: RobotsSource, path: string, userAgent = DEFAULT_COLLECTOR_USER_AGENT): Promise<RobotsAuditResult> {
  const audit = await auditRobotsSource({ ...source, samplePaths: [path] }, userAgent);
  const decision = audit.decisions[0];
  if (!audit.ok || !decision?.allowed) {
    const reason = audit.error ?? decision?.matchedRule?.pattern ?? "robots.txt check failed";
    throw new Error(`${source.displayName} collection is blocked by robots policy for ${path}: ${reason}`);
  }
  return audit;
}
