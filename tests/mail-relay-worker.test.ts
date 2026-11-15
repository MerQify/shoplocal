import { describe, expect, it, vi } from "vitest";
import worker, { safeEqual, type Env } from "../workers/mail-relay/src/index";

/**
 * #1627 R1 — the AFC mail relay Worker. Imported by relative path, like
 * tests/inbound-email-worker.test.ts, because it is a separately deployed Worker.
 */

function setup(sendImpl?: () => Promise<unknown>) {
  const send = vi.fn(sendImpl ?? (async () => undefined));
  const env: Env = {
    EMAIL: { send },
    RELAY_TOKEN: "relay-secret",
    ALLOWED_FROM_DOMAINS: "aheedfoodcentre.co.uk",
  };
  return { env, send };
}

const valid = {
  from: { name: "Aheed Food Centre", email: "info@aheedfoodcentre.co.uk" },
  to: "shopper@example.com",
  subject: "Your order AHE-1",
  html: "<p>Thanks</p>",
  text: "Thanks",
  replyTo: "info@aheedfoodcentre.co.uk",
};

function post(
  body: unknown,
  token: string | null = "relay-secret",
  path = "/send",
  method = "POST",
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request(`https://relay.test${path}`, {
    method,
    headers,
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

describe("#1627 R1 — mail relay Worker", () => {
  it("404s anything but POST /send", async () => {
    const { env, send } = setup();
    expect((await worker.fetch(post(valid, "relay-secret", "/other"), env)).status).toBe(404);
    expect((await worker.fetch(post(null, "relay-secret", "/send", "GET"), env)).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["no token", null],
    ["a wrong token", "nope"],
  ])("401s with %s and never sends", async (_label, token) => {
    const { env, send } = setup();
    expect((await worker.fetch(post(valid, token), env)).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("403s a from address outside ALLOWED_FROM_DOMAINS", async () => {
    const { env, send } = setup();
    const res = await worker.fetch(
      post({ ...valid, from: { name: "X", email: "x@evil.test" } }),
      env,
    );
    expect(res.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a missing to", { ...valid, to: "" }],
    ["a missing subject", { ...valid, subject: undefined }],
    ["a missing html", { ...valid, html: "" }],
  ])("400s %s", async (_label, body) => {
    const { env, send } = setup();
    expect((await worker.fetch(post(body), env)).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a valid request once, passing every field through", async () => {
    const { env, send } = setup();
    const res = await worker.fetch(post(valid), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      from: valid.from,
      to: valid.to,
      subject: valid.subject,
      html: valid.html,
      text: valid.text,
      replyTo: valid.replyTo,
    });
  });

  it("502s with the reason when the binding throws", async () => {
    const { env, send } = setup(async () => {
      throw new Error("quota exceeded");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await worker.fetch(post(valid), env);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: "failed", reason: "quota exceeded" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("compares tokens in constant time but correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
