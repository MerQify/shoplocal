import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSender } from "@/lib/email/policy";
import { createRelayAdapter } from "@/lib/email/relay";
import type { ResolvedEmail } from "@/lib/email/types";

/**
 * #1627 R3–R6 — the mail relay: sender policy, the relay adapter, and the port's relay-then-fallback
 * path. Same Worker-context mock as tests/email.test.ts: config is read from process.env, and the
 * `EMAIL` binding is put into (or left out of) the fake Worker context.
 */

const cfEnv: { current: Record<string, unknown> | null } = { current: null };
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (!cfEnv.current) throw new Error("not in a Worker");
    return { env: cfEnv.current };
  },
}));
vi.mock("@/lib/db", () => ({ getPrisma: () => ({}) }));
vi.mock("@/lib/repositories/inbound-address", () => ({ isRegisteredForwardTo: async () => false }));

const STORE = { name: "Aheed Food Centre", email: "info@aheedfoodcentre.co.uk" };
const RELAY_URL = "https://afc-mail-relay.example.workers.dev";
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  for (const k of [
    "EMAIL_PROVIDER",
    "EMAIL_VERIFIED_DOMAINS",
    "EMAIL_ALLOWED_RECIPIENTS",
    "EMAIL_RELAY_URL",
    "EMAIL_RELAY_TOKEN",
    "EMAIL_RELAY_DOMAINS",
    "APP_ENV",
  ])
    delete process.env[k];
  process.env.EMAIL_FROM = "no-reply@merqify.test";
  process.env.EMAIL_RECIPIENT_MODE = "open";
  process.env.APP_ENV = "production";
  cfEnv.current = null;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R3 — resolveSender with relay domains", () => {
  const base = { sender: STORE, platformFrom: "no-reply@merqify.test", platformName: "Merqify" };

  it("sends as the store via the relay when the domain is a relay domain", () => {
    expect(
      resolveSender({ ...base, verifiedDomains: "", relayDomains: "aheedfoodcentre.co.uk" }),
    ).toEqual({ from: STORE, via: "relay" });
  });

  it("prefers this Worker's own binding when the domain is also verified here", () => {
    expect(
      resolveSender({
        ...base,
        verifiedDomains: "aheedfoodcentre.co.uk",
        relayDomains: "aheedfoodcentre.co.uk",
      }),
    ).toEqual({ from: STORE });
  });

  it("falls back to the platform sender with Reply-To the store otherwise", () => {
    expect(resolveSender({ ...base, verifiedDomains: "", relayDomains: "" })).toEqual({
      from: { name: STORE.name, email: "no-reply@merqify.test" },
      replyTo: STORE.email,
    });
  });
});

describe("R4 — the relay adapter", () => {
  const message: ResolvedEmail = {
    from: STORE,
    replyTo: STORE.email,
    to: "shopper@example.com",
    subject: "Order AHE-1",
    html: "<p>x</p>",
    text: "x",
  };

  it("POSTs JSON to <url>/send with the bearer token, and reports sent on 2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"status":"sent"}', { status: 200 }));
    const result = await createRelayAdapter(`${RELAY_URL}/`, "tok", fetchImpl).deliver(message);
    expect(result).toEqual({ status: "sent" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${RELAY_URL}/send`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: STORE,
      to: "shopper@example.com",
      replyTo: STORE.email,
    });
  });

  it("reports failed with the relay's reason on a non-2xx", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"status":"failed","reason":"quota"}', { status: 502 }),
    );
    expect(await createRelayAdapter(RELAY_URL, "tok", fetchImpl).deliver(message)).toEqual({
      status: "failed",
      reason: "relay answered 502: quota",
    });
  });

  it("reports failed, never throws, when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const result = await createRelayAdapter(RELAY_URL, "tok", fetchImpl).deliver(message);
    expect(result.status).toBe("failed");
  });
});

describe("R5/R6 — the port's relay path and fallback", () => {
  function configureRelay() {
    process.env.EMAIL_RELAY_URL = RELAY_URL;
    process.env.EMAIL_RELAY_TOKEN = "tok";
    process.env.EMAIL_RELAY_DOMAINS = "aheedfoodcentre.co.uk";
  }
  async function sendAsStore() {
    const { getEmailService } = await import("@/lib/email");
    return getEmailService().send({
      to: "shopper@example.com",
      subject: "Order AHE-1",
      html: "<p>x</p>",
      sender: STORE,
    });
  }

  it("delivers through the relay as the store, without touching the binding", async () => {
    configureRelay();
    const binding = { send: vi.fn() };
    cfEnv.current = { EMAIL: binding };
    const fetchMock = vi.fn(async () => new Response('{"status":"sent"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendAsStore()).toEqual({ status: "sent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(binding.send).not.toHaveBeenCalled();
  });

  it("falls back to the binding with the platform From and the store Reply-To when the relay fails", async () => {
    configureRelay();
    const binding = { send: vi.fn().mockResolvedValue({}) };
    cfEnv.current = { EMAIL: binding };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"status":"failed"}', { status: 502 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendAsStore()).toEqual({ status: "sent" });
    expect(binding.send).toHaveBeenCalledTimes(1);
    expect(binding.send.mock.calls[0][0]).toMatchObject({
      from: { name: STORE.name, email: "no-reply@merqify.test" },
      replyTo: STORE.email,
    });
  });

  it("never calls the relay when its token is missing (R6)", async () => {
    configureRelay();
    delete process.env.EMAIL_RELAY_TOKEN;
    const binding = { send: vi.fn().mockResolvedValue({}) };
    cfEnv.current = { EMAIL: binding };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendAsStore()).toEqual({ status: "sent" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(binding.send.mock.calls[0][0]).toMatchObject({
      from: { name: STORE.name, email: "no-reply@merqify.test" },
      replyTo: STORE.email,
    });
  });
});
