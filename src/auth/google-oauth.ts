import crypto, { type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createRemoteJWKSet,
  exportJWK,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: crypto.webcrypto });
}

export const CHECKOUT_SCOPE = "omnimall.checkout";
export const OAUTH_RESOURCE_SCOPES = [CHECKOUT_SCOPE] as const;
export const OAUTH_SERVER_SCOPES = ["openid", "profile", "email", CHECKOUT_SCOPE] as const;
export const OAUTH_SECURITY_SCHEMES = [{ type: "oauth2" as const, scopes: [CHECKOUT_SCOPE] }];

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const LOCAL_AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const GOOGLE_AUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthClient = {
  client_id: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
  client_name?: string;
  scope?: string;
};

type PendingGoogleAuthorization = {
  client: OAuthClient;
  redirectUri: string;
  chatgptState?: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  googleCodeVerifier: string;
  googleNonce: string;
  baseUrl: string;
  expiresAtMs: number;
};

type LocalAuthorizationCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  user: OmniMallAuthUser;
  expiresAtMs: number;
};

export type OmniMallAuthUser = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  hostedDomain?: string;
};

export type OmniMallAuthInfo = {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  resource: string;
  user: OmniMallAuthUser;
};

export type RequestAuthContext = {
  baseUrl: string;
  auth?: OmniMallAuthInfo;
  authError?: string;
};

type AccessTokenClaims = JWTPayload & {
  client_id: string;
  scope: string;
  resource: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  hd?: string;
};

type RefreshTokenClaims = AccessTokenClaims & {
  token_use: "refresh";
};

const pendingGoogleAuthorizations = new Map<string, PendingGoogleAuthorization>();
const localAuthorizationCodes = new Map<string, LocalAuthorizationCode>();
let clientsCache: Map<string, OAuthClient> | undefined;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function googleAuthConfigured(): boolean {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

function mcpResource(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/mcp`;
}

function publicUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function protectedResourceMetadataUrl(baseUrl: string): string {
  return publicUrl(baseUrl, "/.well-known/oauth-protected-resource/mcp");
}

function accessTokenTtlSeconds(): number {
  return Number(env("ACCESS_TOKEN_TTL_SECONDS") ?? 60 * 60);
}

function refreshTokenTtlSeconds(): number {
  return Number(env("REFRESH_TOKEN_TTL_SECONDS") ?? 30 * 24 * 60 * 60);
}

function googleRedirectUri(baseUrl: string): string {
  return env("GOOGLE_REDIRECT_URI") ?? publicUrl(baseUrl, "/callback");
}

function googleScopes(): string[] {
  return (env("GOOGLE_SCOPES") ?? "openid email profile").split(/\s+/).filter(Boolean);
}

function parseScope(scope: string | null | undefined): string[] {
  return Array.from(new Set((scope ?? "").split(/\s+/).map((item) => item.trim()).filter(Boolean)));
}

function localScopes(scope: string | null | undefined): string[] {
  const requested = parseScope(scope).filter((item) => OAUTH_SERVER_SCOPES.includes(item as (typeof OAUTH_SERVER_SCOPES)[number]));
  return Array.from(new Set([...requested, CHECKOUT_SCOPE]));
}

function base64UrlRandom(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function s256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function clientsFilePath(): string {
  return `${process.cwd()}/data/oauth-clients.json`;
}

function loadClients(): Map<string, OAuthClient> {
  if (clientsCache) return clientsCache;

  clientsCache = new Map<string, OAuthClient>();
  const filePath = clientsFilePath();
  if (!existsSync(filePath)) return clientsCache;

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as OAuthClient[];
    for (const client of parsed) {
      if (client.client_id) clientsCache.set(client.client_id, client);
    }
  } catch {
    clientsCache = new Map<string, OAuthClient>();
  }
  return clientsCache;
}

function persistClients(clients: Map<string, OAuthClient>): void {
  mkdirSync(`${process.cwd()}/data`, { recursive: true });
  writeFileSync(clientsFilePath(), `${JSON.stringify(Array.from(clients.values()), null, 2)}\n`);
}

function isAllowedRedirectUri(redirectUri: string): boolean {
  const allowInsecure = process.env.ALLOW_INSECURE_REDIRECTS === "true";
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") return true;
    return allowInsecure && url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res: ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(text);
}

async function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) throw new Error("Request body too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function redirectWithOAuthError(
  res: ServerResponse,
  redirectUri: string,
  state: string | undefined,
  error: string,
  description: string,
): void {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  res.writeHead(302, { location: target.href, "cache-control": "no-store" });
  res.end();
}

function validateResource(baseUrl: string, value: string | null | undefined): string {
  const expected = mcpResource(baseUrl);
  const requested = value ?? expected;
  if (requested !== expected) {
    throw new Error(`Invalid resource parameter. Expected ${expected}.`);
  }
  return requested;
}

function keyPath(): string {
  return `${process.cwd()}/data/oauth-jwt-private-key.pem`;
}

function loadOrCreateSigningKey(): { privateKey: KeyObject; publicKey: KeyObject } {
  const fromEnv = env("OAUTH_JWT_PRIVATE_KEY_PEM");
  if (fromEnv) {
    const privateKey = crypto.createPrivateKey(fromEnv.replace(/\\n/g, "\n"));
    return { privateKey, publicKey: crypto.createPublicKey(privateKey) };
  }

  const path = keyPath();
  if (existsSync(path)) {
    const privateKey = crypto.createPrivateKey(readFileSync(path, "utf8"));
    return { privateKey, publicKey: crypto.createPublicKey(privateKey) };
  }

  mkdirSync(`${process.cwd()}/data`, { recursive: true });
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync(path, String(privateKey.export({ type: "pkcs8", format: "pem" })), { mode: 0o600 });
  return { privateKey, publicKey };
}

export async function currentJwks(): Promise<Record<string, unknown>> {
  const { publicKey } = loadOrCreateSigningKey();
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "omnimall-google-oauth-current";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";
  return { keys: [publicJwk] };
}

export function currentProtectedResourceMetadata(baseUrl: string): Record<string, unknown> {
  return {
    resource: mcpResource(baseUrl),
    authorization_servers: [normalizeBaseUrl(baseUrl)],
    scopes_supported: OAUTH_RESOURCE_SCOPES,
    bearer_methods_supported: ["header"],
    jwks_uri: publicUrl(baseUrl, "/jwks"),
    resource_name: "OmniMall MCP",
  };
}

export function currentOAuthAuthorizationServerMetadata(baseUrl: string): Record<string, unknown> {
  return {
    issuer: normalizeBaseUrl(baseUrl),
    authorization_endpoint: publicUrl(baseUrl, "/authorize"),
    token_endpoint: publicUrl(baseUrl, "/token"),
    registration_endpoint: publicUrl(baseUrl, "/register"),
    jwks_uri: publicUrl(baseUrl, "/jwks"),
    client_id_metadata_document_supported: false,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: OAUTH_SERVER_SCOPES,
  };
}

export function currentOpenIdConfiguration(baseUrl: string): Record<string, unknown> {
  return {
    ...currentOAuthAuthorizationServerMetadata(baseUrl),
    userinfo_endpoint: publicUrl(baseUrl, "/userinfo"),
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

export function authChallenge(baseUrl: string, error = "invalid_token", description = "Google login is required."): string {
  return `Bearer resource_metadata="${protectedResourceMetadataUrl(baseUrl)}", error="${error}", error_description="${description}"`;
}

export function authRequiredResult(baseUrl: string, description = "Google login is required for checkout."): Record<string, unknown> {
  return {
    content: [{ type: "text", text: description }],
    structuredContent: {
      authenticated: false,
      authProvider: "google",
      message: description,
    },
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        authChallenge(baseUrl, "invalid_token", description),
      ],
    },
  };
}

export function missingRequiredScope(authInfo: OmniMallAuthInfo | undefined, scope: string): boolean {
  return !authInfo?.scopes.includes(scope);
}

export async function handleClientRegistration(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" }, { allow: "POST" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((value): value is string => typeof value === "string")
      : [];

    if (redirectUris.length === 0) {
      sendJson(res, 400, { error: "invalid_request", error_description: "redirect_uris is required" });
      return;
    }
    const invalidRedirect = redirectUris.find((redirectUri) => !isAllowedRedirectUri(redirectUri));
    if (invalidRedirect) {
      sendJson(res, 400, { error: "invalid_redirect_uri", error_description: `Unsupported redirect_uri: ${invalidRedirect}` });
      return;
    }
    if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
      sendJson(res, 400, { error: "invalid_client_metadata", error_description: "Only token_endpoint_auth_method=none is supported." });
      return;
    }

    const clients = loadClients();
    const registered: OAuthClient = {
      client_id: `chatgpt-${crypto.randomUUID()}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: typeof body.client_name === "string" ? body.client_name : "ChatGPT",
      scope: typeof body.scope === "string" ? body.scope : OAUTH_SERVER_SCOPES.join(" "),
    };
    clients.set(registered.client_id, registered);
    persistClients(clients);
    sendJson(res, 201, registered);
  } catch (error) {
    sendJson(res, 400, {
      error: "invalid_request",
      error_description: error instanceof Error ? error.message : "Invalid registration request.",
    });
  }
}

export async function handleAuthorize(req: IncomingMessage, res: ServerResponse, baseUrl: string): Promise<void> {
  const url = new URL(req.url ?? "/authorize", baseUrl);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? undefined;

  const client = loadClients().get(clientId);
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri)) {
    sendJson(res, 400, { error: "invalid_request", error_description: "Unknown client or unregistered redirect_uri." });
    return;
  }

  try {
    if (url.searchParams.get("response_type") !== "code") throw new Error("response_type=code is required.");
    const codeChallenge = url.searchParams.get("code_challenge");
    if (!codeChallenge) throw new Error("PKCE code_challenge is required.");
    if (url.searchParams.get("code_challenge_method") !== "S256") throw new Error("code_challenge_method=S256 is required.");
    const resource = validateResource(baseUrl, url.searchParams.get("resource"));

    if (!googleAuthConfigured()) {
      redirectWithOAuthError(
        res,
        redirectUri,
        state,
        "server_error",
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured on the OmniMall server.",
      );
      return;
    }

    const internalState = base64UrlRandom();
    const googleCodeVerifier = base64UrlRandom(48);
    const googleNonce = base64UrlRandom();
    pendingGoogleAuthorizations.set(internalState, {
      client,
      redirectUri,
      chatgptState: state,
      codeChallenge,
      scopes: localScopes(url.searchParams.get("scope")),
      resource,
      googleCodeVerifier,
      googleNonce,
      baseUrl,
      expiresAtMs: Date.now() + GOOGLE_AUTH_STATE_TTL_MS,
    });

    const target = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    target.searchParams.set("client_id", env("GOOGLE_CLIENT_ID")!);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("redirect_uri", googleRedirectUri(baseUrl));
    target.searchParams.set("scope", googleScopes().join(" "));
    target.searchParams.set("state", internalState);
    target.searchParams.set("nonce", googleNonce);
    target.searchParams.set("code_challenge", s256(googleCodeVerifier));
    target.searchParams.set("code_challenge_method", "S256");
    target.searchParams.set("access_type", "offline");
    target.searchParams.set("prompt", "select_account consent");

    res.writeHead(302, { location: target.href, "cache-control": "no-store" });
    res.end();
  } catch (error) {
    redirectWithOAuthError(
      res,
      redirectUri,
      state,
      "invalid_request",
      error instanceof Error ? error.message : "Invalid authorization request.",
    );
  }
}

export async function handleGoogleCallback(req: IncomingMessage, res: ServerResponse, fallbackBaseUrl: string): Promise<void> {
  const url = new URL(req.url ?? "/callback", fallbackBaseUrl);
  const state = url.searchParams.get("state") ?? "";
  const pending = pendingGoogleAuthorizations.get(state);

  if (!pending) {
    sendText(res, 400, "Missing, expired, or invalid Google OAuth state.");
    return;
  }
  pendingGoogleAuthorizations.delete(state);

  if (pending.expiresAtMs < Date.now()) {
    redirectWithOAuthError(res, pending.redirectUri, pending.chatgptState, "invalid_grant", "Google login state expired.");
    return;
  }
  if (url.searchParams.get("error")) {
    redirectWithOAuthError(
      res,
      pending.redirectUri,
      pending.chatgptState,
      "access_denied",
      url.searchParams.get("error_description") ?? "Google authorization failed.",
    );
    return;
  }

  try {
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Missing Google authorization code.");
    const tokens = await exchangeGoogleCode(code, pending.googleCodeVerifier, pending.baseUrl);
    if (typeof tokens.id_token !== "string") throw new Error("Google token response did not include an id_token.");

    const user = await verifyGoogleIdToken(tokens.id_token, pending.googleNonce, pending.baseUrl);
    validateAllowedEmail(user);

    const localCode = base64UrlRandom();
    localAuthorizationCodes.set(localCode, {
      clientId: pending.client.client_id,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scopes: pending.scopes,
      resource: pending.resource,
      user,
      expiresAtMs: Date.now() + LOCAL_AUTH_CODE_TTL_MS,
    });

    const target = new URL(pending.redirectUri);
    target.searchParams.set("code", localCode);
    if (pending.chatgptState) target.searchParams.set("state", pending.chatgptState);
    res.writeHead(302, { location: target.href, "cache-control": "no-store" });
    res.end();
  } catch (error) {
    redirectWithOAuthError(
      res,
      pending.redirectUri,
      pending.chatgptState,
      "invalid_grant",
      error instanceof Error ? error.message : "Google callback failed.",
    );
  }
}

async function exchangeGoogleCode(code: string, codeVerifier: string, baseUrl: string): Promise<Record<string, unknown>> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID") ?? "",
      client_secret: env("GOOGLE_CLIENT_SECRET") ?? "",
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(baseUrl),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${String(payload.error_description ?? response.statusText)}`);
  }
  return payload;
}

async function verifyGoogleIdToken(idToken: string, expectedNonce: string, baseUrl: string): Promise<OmniMallAuthUser> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience: env("GOOGLE_CLIENT_ID"),
  });

  if (!GOOGLE_ISSUERS.has(String(payload.iss))) throw new Error("Google id_token issuer is invalid.");
  if (payload.nonce !== expectedNonce) throw new Error("Google id_token nonce mismatch.");

  const user: OmniMallAuthUser = {
    sub: stringClaim(payload.sub) ?? "unknown",
    email: stringClaim(payload.email),
    emailVerified: typeof payload.email_verified === "boolean" ? payload.email_verified : undefined,
    name: stringClaim(payload.name),
    picture: stringClaim(payload.picture),
    hostedDomain: stringClaim(payload.hd),
  };
  if (!user.email) throw new Error("Google account did not provide an email claim.");
  if (user.sub === "unknown") throw new Error(`Invalid Google subject for ${mcpResource(baseUrl)}.`);
  return user;
}

function validateAllowedEmail(user: OmniMallAuthUser): void {
  const raw = env("GOOGLE_ALLOWED_EMAIL_DOMAINS") ?? env("OMNIMALL_ALLOWED_EMAIL_DOMAINS");
  if (!raw) return;

  const domains = raw.split(",").map((item) => item.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
  if (domains.length === 0) return;

  const email = user.email?.toLowerCase() ?? "";
  const domain = email.split("@").at(-1) ?? "";
  if (!domains.includes(domain)) {
    throw new Error(`The signed-in email domain ${domain || "(unknown)"} is not allowed for OmniMall.`);
  }
}

export async function handleToken(req: IncomingMessage, res: ServerResponse, baseUrl: string): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" }, { allow: "POST" });
    return;
  }

  try {
    const form = new URLSearchParams(await readBody(req));
    const clientId = form.get("client_id") ?? "";
    const client = loadClients().get(clientId);
    if (!client) {
      sendJson(res, 401, { error: "invalid_client", error_description: "Unknown client_id." });
      return;
    }

    const grantType = form.get("grant_type");
    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      if (!refreshToken) {
        sendJson(res, 400, { error: "invalid_request", error_description: "refresh_token is required." });
        return;
      }
      const tokens = await exchangeRefreshToken(client, refreshToken, baseUrl);
      sendJson(res, 200, tokens);
      return;
    }

    if (grantType !== "authorization_code") {
      sendJson(res, 400, { error: "unsupported_grant_type", error_description: "Only authorization_code and refresh_token are supported." });
      return;
    }

    const code = form.get("code") ?? "";
    const codeVerifier = form.get("code_verifier") ?? "";
    const localCode = localAuthorizationCodes.get(code);
    if (!localCode || localCode.expiresAtMs < Date.now()) throw new Error("Invalid or expired authorization code.");
    localAuthorizationCodes.delete(code);
    if (localCode.clientId !== client.client_id) throw new Error("Authorization code was not issued to this client.");
    if (form.get("redirect_uri") && form.get("redirect_uri") !== localCode.redirectUri) throw new Error("redirect_uri does not match the authorization request.");
    if (!codeVerifier || s256(codeVerifier) !== localCode.codeChallenge) throw new Error("PKCE verification failed.");

    const resource = validateResource(baseUrl, form.get("resource") ?? localCode.resource);
    if (resource !== localCode.resource) throw new Error("resource does not match the authorization request.");

    const tokens = await issueTokens(baseUrl, client.client_id, localCode.user, localCode.scopes, resource, true);
    sendJson(res, 200, tokens);
  } catch (error) {
    sendJson(res, 400, {
      error: "invalid_grant",
      error_description: error instanceof Error ? error.message : "Token request failed.",
    });
  }
}

async function exchangeRefreshToken(client: OAuthClient, refreshToken: string, baseUrl: string): Promise<Record<string, unknown>> {
  const { publicKey } = loadOrCreateSigningKey();
  const { payload } = await jwtVerify<RefreshTokenClaims>(refreshToken, publicKey, {
    issuer: normalizeBaseUrl(baseUrl),
    audience: normalizeBaseUrl(baseUrl),
  });

  if (payload.token_use !== "refresh") throw new Error("Invalid refresh token.");
  if (payload.client_id !== client.client_id) throw new Error("Refresh token was not issued to this client.");
  if (payload.resource !== mcpResource(baseUrl)) throw new Error("Refresh token resource does not match this MCP server.");

  return issueTokens(
    baseUrl,
    client.client_id,
    {
      sub: payload.sub ?? "unknown",
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      hostedDomain: payload.hd,
    },
    parseScope(payload.scope),
    payload.resource,
    true,
  );
}

async function issueTokens(
  baseUrl: string,
  clientId: string,
  user: OmniMallAuthUser,
  scopes: string[],
  resource: string,
  includeRefreshToken: boolean,
): Promise<Record<string, unknown>> {
  const { privateKey } = loadOrCreateSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + accessTokenTtlSeconds();
  const commonClaims = {
    client_id: clientId,
    scope: scopes.join(" "),
    resource,
    email: user.email,
    email_verified: user.emailVerified,
    name: user.name,
    picture: user.picture,
    hd: user.hostedDomain,
  };

  const accessToken = await new SignJWT(commonClaims)
    .setProtectedHeader({ alg: "RS256", kid: "omnimall-google-oauth-current" })
    .setIssuer(normalizeBaseUrl(baseUrl))
    .setAudience(resource)
    .setSubject(user.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  const idToken = await new SignJWT({
    email: user.email,
    email_verified: user.emailVerified,
    name: user.name,
    picture: user.picture,
    hd: user.hostedDomain,
  })
    .setProtectedHeader({ alg: "RS256", kid: "omnimall-google-oauth-current" })
    .setIssuer(normalizeBaseUrl(baseUrl))
    .setAudience(clientId)
    .setSubject(user.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtlSeconds(),
    expires_at: expiresAt,
    scope: scopes.join(" "),
    id_token: idToken,
  };

  if (includeRefreshToken) {
    response.refresh_token = await new SignJWT({
      ...commonClaims,
      token_use: "refresh",
    })
      .setProtectedHeader({ alg: "RS256", kid: "omnimall-google-oauth-current" })
      .setIssuer(normalizeBaseUrl(baseUrl))
      .setAudience(normalizeBaseUrl(baseUrl))
      .setSubject(user.sub)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + refreshTokenTtlSeconds())
      .sign(privateKey);
  }

  return response;
}

export async function verifyAccessToken(token: string, baseUrl: string): Promise<OmniMallAuthInfo> {
  const { publicKey } = loadOrCreateSigningKey();
  const resource = mcpResource(baseUrl);
  const { payload } = await jwtVerify<AccessTokenClaims>(token, publicKey, {
    issuer: normalizeBaseUrl(baseUrl),
    audience: resource,
  });

  if (payload.resource !== resource) throw new Error("Token resource does not match this MCP server.");

  return {
    token,
    clientId: payload.client_id,
    scopes: parseScope(payload.scope),
    expiresAt: payload.exp,
    resource,
    user: {
      sub: payload.sub ?? "unknown",
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      hostedDomain: payload.hd,
    },
  };
}

export async function verifyBearerAuth(req: IncomingMessage, baseUrl: string): Promise<RequestAuthContext> {
  const header = req.headers.authorization;
  if (!header?.toLowerCase().startsWith("bearer ")) return { baseUrl };

  const token = header.slice("bearer ".length).trim();
  try {
    return { baseUrl, auth: await verifyAccessToken(token, baseUrl) };
  } catch (error) {
    return { baseUrl, authError: error instanceof Error ? error.message : String(error) };
  }
}

export async function handleUserInfo(req: IncomingMessage, res: ServerResponse, baseUrl: string): Promise<void> {
  const context = await verifyBearerAuth(req, baseUrl);
  if (!context.auth) {
    sendJson(
      res,
      401,
      {
        error: "invalid_token",
        error_description: context.authError ?? "A valid bearer token is required.",
      },
      { "WWW-Authenticate": authChallenge(baseUrl) },
    );
    return;
  }

  sendJson(res, 200, {
    sub: context.auth.user.sub,
    email: context.auth.user.email,
    email_verified: context.auth.user.emailVerified,
    name: context.auth.user.name,
    picture: context.auth.user.picture,
    hd: context.auth.user.hostedDomain,
  });
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
