import type { EmailSender } from "./types";

/**
 * The two pure decisions behind every outgoing email (#1217). Pure so the Client Setup dashboard
 * can show a vendor exactly which From address its mail goes out with, by calling the same
 * function the sender calls rather than re-deriving it.
 */

/** Splits a comma-separated config value into lower-cased, trimmed, non-empty entries. */
export function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function emailDomain(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1
    ? ""
    : address
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

export interface ResolvedSender {
  from: EmailSender;
  replyTo?: string;
  /** #1627 — deliver through the mail relay Worker rather than this Worker's own binding. */
  via?: "relay";
}

/**
 * R5. A vendor sends from its own address once its domain is onboarded (listed in
 * EMAIL_VERIFIED_DOMAINS). Until then it sends from the platform address with Reply-To set to the
 * vendor, so replies still reach the store. No sender means the platform itself.
 *
 * #1627 — a domain onboarded in a DIFFERENT Cloudflare account (listed in `relayDomains`, the relay
 * fully configured) also sends as the vendor, but through the mail relay Worker. Verified wins: a
 * domain this Worker can send from itself never takes the extra hop.
 */
export function resolveSender(input: {
  sender?: EmailSender;
  verifiedDomains: string | undefined;
  relayDomains?: string | undefined;
  platformFrom: string;
  platformName: string;
}): ResolvedSender {
  const { sender, platformFrom, platformName } = input;
  if (!sender) return { from: { name: platformName, email: platformFrom } };

  const domain = sender.email ? emailDomain(sender.email) : "";
  if (domain && parseEmailList(input.verifiedDomains).includes(domain)) {
    return { from: { name: sender.name, email: sender.email } };
  }
  if (domain && parseEmailList(input.relayDomains).includes(domain)) {
    return { from: { name: sender.name, email: sender.email }, via: "relay" };
  }
  return {
    from: { name: sender.name, email: platformFrom },
    ...(sender.email ? { replyTo: sender.email } : {}),
  };
}

/**
 * R6. `open` allows every recipient. Anything else — including unset — is allowlist mode: only
 * addresses in EMAIL_ALLOWED_RECIPIENTS. An empty allowlist therefore sends nothing.
 */
export function isRecipientAllowed(input: {
  to: string;
  mode: string | undefined;
  allowedRecipients: string | undefined;
}): boolean {
  if ((input.mode ?? "").trim().toLowerCase() === "open") return true;
  return parseEmailList(input.allowedRecipients).includes(input.to.trim().toLowerCase());
}
