import type { EmailAdapter, ResolvedEmail } from "./types";

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Mail relay adapter (#1627): delivers through `workers/mail-relay`, a Worker in the Cloudflare
 * account where the store's sending domain is onboarded. Used only for messages `resolveSender`
 * marks `via: "relay"`; `lib/email.ts` falls back to the platform sender when this fails.
 *
 * Never throws. `fetch` is a parameter so tests can fake it, and is wrapped by the caller because
 * workerd can reject a detached fetch ("Illegal invocation").
 */
export function createRelayAdapter(url: string, token: string, fetchImpl: Fetch): EmailAdapter {
  const endpoint = `${url.replace(/\/+$/, "")}/send`;
  return {
    name: "relay",
    async deliver(message: ResolvedEmail) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          }),
        });
        if (response.ok) return { status: "sent" };
        let reason = `relay answered ${response.status}`;
        try {
          const body = (await response.json()) as { reason?: string; status?: string };
          if (body.reason || body.status) reason += `: ${body.reason ?? body.status}`;
        } catch {
          // A non-JSON error body adds nothing worth logging.
        }
        return { status: "failed", reason };
      } catch (error) {
        return {
          status: "failed",
          reason: `relay unreachable: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
