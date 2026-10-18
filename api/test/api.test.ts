import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createApp } from "../src/index";
import { makeD1 } from "./helpers/d1";

const ISSUER = "https://test.clerk.example";
let privateKey: CryptoKey, publicKey: CryptoKey, otherPrivate: CryptoKey;

beforeAll(async () => {
  ({ privateKey, publicKey } = await generateKeyPair("RS256"));
  ({ privateKey: otherPrivate } = await generateKeyPair("RS256"));
});

const token = (sub: string, opts: { key?: CryptoKey; iss?: string; exp?: string; claims?: Record<string, unknown> } = {}) =>
  new SignJWT({ ...(opts.claims ?? {}) })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub).setIssuer(opts.iss ?? ISSUER).setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);

function setup() {
  const { db, d1 } = makeD1();
  const app = createApp(() => publicKey);
  const env = { DB: d1, ENVIRONMENT: "test", CLERK_ISSUER: ISSUER, CLERK_JWKS_URL: "x" } as any;
  const call = (path: string, init: RequestInit = {}) => app.request(path, init, env);
  const authed = (t: string, init: RequestInit = {}) =>
    call("/v1/me", { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers as any) } });
  return { db, call, authed };
}

describe("auth middleware", () => {
  it("health is public", async () => {
    const { call } = setup();
    expect((await call("/health")).status).toBe(200);
  });
  it("rejects missing token", async () => {
    const { call } = setup();
    const r = await call("/v1/me");
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "missing_token" });
  });
  it("rejects garbage, wrong-key, wrong-issuer and expired tokens", async () => {
    const { authed } = setup();
    expect((await authed("garbage")).status).toBe(401);
    expect((await authed(await token("u1", { key: otherPrivate }))).status).toBe(401);
    expect((await authed(await token("u1", { iss: "https://evil.example" }))).status).toBe(401);
    expect((await authed(await token("u1", { exp: "-1m" }))).status).toBe(401);
  });
  it("rejects alg=none style forged tokens", async () => {
    const { authed } = setup();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const forged = `${b64({ alg: "none" })}.${b64({ sub: "u1", iss: ISSUER, exp: 9999999999 })}.`;
    expect((await authed(forged)).status).toBe(401);
  });
  it("creates user + profile on first valid request, idempotently", async () => {
    const { authed, db } = setup();
    const t = await token("user_abc", { claims: { name: "Tunde A.", email: "t@x.com" } });
    const r1 = await authed(t);
    expect(r1.status).toBe(200);
    const body: any = await r1.json();
    expect(body.displayName).toBe("Tunde A.");
    expect(body.role).toBe("user");
    expect(body.identityVerified).toBe(0);
    await authed(t);
    expect((db.prepare("SELECT COUNT(*) c FROM users").get() as any).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) c FROM profiles").get() as any).c).toBe(1);
  });
  it("ignores role claims in the token (role comes from D1)", async () => {
    const { authed } = setup();
    const r: any = await (await authed(await token("sneaky", { claims: { role: "admin", public_metadata: { role: "admin" } } }))).json();
    expect(r.role).toBe("user");
  });
  it("blocks suspended accounts", async () => {
    const { authed, db } = setup();
    const t = await token("bad_actor");
    await authed(t);
    db.prepare("UPDATE users SET status='suspended' WHERE clerk_user_id='bad_actor'").run();
    const r = await authed(t);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "account_suspended" });
  });
});

describe("PATCH /v1/me", () => {
  it("updates profile fields and writes an audit log", async () => {
    const { authed, db } = setup();
    const t = await token("u2");
    await authed(t);
    const r = await authed(t, { method: "PATCH", body: JSON.stringify({ displayName: "Chioma E.", handle: "chioma_e", city: "Lekki", state: "Lagos" }) });
    expect(r.status).toBe(200);
    const me: any = await (await authed(t)).json();
    expect(me.handle).toBe("chioma_e");
    expect(me.city).toBe("Lekki");
    expect((db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action='profile.update'").get() as any).c).toBe(1);
  });
  it("validates input", async () => {
    const { authed } = setup();
    const t = await token("u3");
    await authed(t);
    const p = (b: unknown) => authed(t, { method: "PATCH", body: JSON.stringify(b) });
    expect((await p({ handle: "A!" })).status).toBe(400);
    expect((await p({ displayName: "" })).status).toBe(400);
    expect((await p({ bio: "x".repeat(300) })).status).toBe(400);
    expect((await p({})).status).toBe(400);
    expect((await authed(t, { method: "PATCH", body: "{not json" })).status).toBe(400);
  });
  it("cannot change role/status via PATCH (unknown fields ignored, no changes -> 400)", async () => {
    const { authed, db } = setup();
    const t = await token("u4");
    await authed(t);
    const r = await authed(t, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
    expect(r.status).toBe(400);
    expect((db.prepare("SELECT role FROM users WHERE clerk_user_id='u4'").get() as any).role).toBe("user");
  });
  it("rejects duplicate handles", async () => {
    const { authed } = setup();
    const a = await token("ua"), b = await token("ub");
    await authed(a); await authed(b);
    await authed(a, { method: "PATCH", body: JSON.stringify({ handle: "taken_one" }) });
    const r = await authed(b, { method: "PATCH", body: JSON.stringify({ handle: "taken_one" }) });
    expect(r.status).toBe(409);
  });
});

describe("migration 0001", () => {
  it("enforces constraints and foreign keys", () => {
    const { db } = setup();
    const now = 1;
    expect(() => db.prepare("INSERT INTO users (id,clerk_user_id,role,created_at,updated_at) VALUES ('1','c','superuser',?,?)").run(now, now)).toThrow();
    expect(() => db.prepare("INSERT INTO profiles (user_id,handle,display_name,created_at,updated_at) VALUES ('nope','h','n',?,?)").run(now, now)).toThrow();
    db.prepare("INSERT INTO users (id,clerk_user_id,created_at,updated_at) VALUES ('1','c',?,?)").run(now, now);
    db.prepare("INSERT INTO profiles (user_id,handle,display_name,created_at,updated_at) VALUES ('1','h','n',?,?)").run(now, now);
    db.prepare("DELETE FROM users WHERE id='1'").run();
    expect((db.prepare("SELECT COUNT(*) c FROM profiles").get() as any).c).toBe(0); // cascade
  });
});
