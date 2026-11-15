/**
 * The AFC mail relay Worker (#1627).
 *
 * WHY IT EXISTS. Cloudflare only lets a Worker's `send_email` binding send from a domain onboarded
 * for Email Sending in the SAME account. The AFC application Workers run in the Merqify account;
 * `aheedfoodcentre.co.uk` is onboarded in the Aheed Food Centre account, where its zone lives. So
 * this Worker runs in the Aheed account, and the application asks it to send store mail
 * (`lib/email/relay.ts`). If it is unreachable the application falls back to its own platform
 * sender, so a confirmation is never lost.
 *
 * GUARDED TWICE. A shared bearer token proves the caller is the application, and only `from`
 * addresses in ALLOWED_FROM_DOMAINS are accepted, so a leaked token still cannot send as anyone else.
 *
 * NOTHING PERSONAL IS LOGGED. No recipient, subject or body is stored or written to the log.
 */

export interface SendEmailBinding {
  send(message: {
    from: { name: string; email: string };
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
  }): Promise<unknown>;
}

export interface Env {
  EMAIL: SendEmailBinding;
  /** Shared secret; the application sends it as `Authorization: Bearer …`. */
  RELAY_TOKEN: string;
  /** Comma-separated domains this relay may send from, e.g. `aheedfoodcentre.co.uk`. */
  ALLOWED_FROM_DOMAINS: string;
}

function json(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Constant-time string comparison, so the token cannot be guessed byte by byte from timing. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1
    ? ""
    : address
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const mailRelayWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/send") {
      return json(404, { status: "not_found" });
    }

    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!env.RELAY_TOKEN || !token || !safeEqual(token, env.RELAY_TOKEN)) {
      return json(401, { status: "unauthorized" });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { status: "bad_request", reason: "body is not JSON" });
    }

    const from = body.from as { name?: unknown; email?: unknown } | undefined;
    if (
      !from ||
      !isNonEmptyString(from.email) ||
      !isNonEmptyString(body.to) ||
      !isNonEmptyString(body.subject) ||
      !isNonEmptyString(body.html)
    ) {
      return json(400, {
        status: "bad_request",
        reason: "from.email, to, subject and html are required",
      });
    }

    const allowed = env.ALLOWED_FROM_DOMAINS.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(domainOf(from.email))) {
      return json(403, { status: "forbidden", reason: "from domain is not allowed" });
    }

    try {
      await env.EMAIL.send({
        from: { name: isNonEmptyString(from.name) ? from.name : "", email: from.email },
        to: body.to,
        subject: body.subject,
        html: body.html,
        ...(isNonEmptyString(body.text) ? { text: body.text } : {}),
        ...(isNonEmptyString(body.replyTo) ? { replyTo: body.replyTo } : {}),
      });
      return json(200, { status: "sent" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`mail-relay send failed: ${reason}`);
      return json(502, { status: "failed", reason });
    }
  },
};

export default mailRelayWorker;
