/**
 * #1671 — typed client for the Merqify Image Hub API (`sriahead/merqify-image-hub`, contract in
 * that repo's `openapi.yaml`).
 *
 * PURE ON PURPOSE, like `lib/repositories/*`: every function takes the hub config, the tenant slug
 * and the actor id as parameters and reads no request context and no `lib/config`. The one module
 * that supplies those from a request is `lib/image-hub-service.ts`. That is what lets every call be
 * exercised from a test or a plain script with a stubbed `fetch`.
 *
 * Errors never throw. A hub error envelope (`{ error: { code, message } }`) comes back as
 * `{ ok: false, code, message }` with the hub's own code; a rejected `fetch` comes back as
 * `code: "unreachable"`, so a caller can tell "the hub said no" from "the hub was not there".
 */

export interface HubConfig {
  /** Base URL with no trailing slash, e.g. `https://merqify-image-hub-staging.….workers.dev`. */
  url: string;
  apiKey: string;
}

/** Who a request acts for. `tenant` is the store's `Vendor.slug`; `actor` the staff user's id. */
export interface HubCaller {
  config: HubConfig;
  tenant: string;
  actor: string;
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export type HubStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type HubSource =
  "UPLOAD" | "AI_GENERATED" | "OPEN_FOOD_FACTS" | "OPENVERSE" | "WIKIMEDIA" | "SUPPLIER";
export type HubLicence =
  | "OWNER_SUPPLIED"
  | "CC0"
  | "PDM"
  | "CC_BY"
  | "CC_BY_SA"
  | "ODBL"
  | "AI_GENERATED"
  | "SUPPLIER_PERMISSION";
/** The only licences a store upload may claim (the hub refuses any other on upload). */
export type HubUploadLicence = Extract<HubLicence, "OWNER_SUPPLIED" | "SUPPLIER_PERMISSION">;
export const HUB_UPLOAD_LICENCES: readonly HubUploadLicence[] = [
  "OWNER_SUPPLIED",
  "SUPPLIER_PERMISSION",
];
export type HubUsageKind = "PRODUCT" | "CATEGORY";

export interface HubUsage {
  id: string;
  kind: HubUsageKind;
  externalId: string;
  createdAt: string;
}

export interface HubAsset {
  id: string;
  title: string;
  alt: string | null;
  status: HubStatus;
  source: HubSource;
  licence: HubLicence;
  attribution: string | null;
  originalUrl: string | null;
  sourceSite: string | null;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  storageKey: string;
  createdAt: string;
  rejectionReason: string | null;
  usages?: HubUsage[];
}

export interface HubPage {
  items: HubAsset[];
  nextCursor: string | null;
}

export type HubResult<T> =
  { ok: true; value: T } | { ok: false; code: string; message: string; status?: number };

export interface SearchParams {
  q?: string;
  status?: HubStatus;
  cursor?: string;
  limit?: number;
}

export interface UploadInput {
  file: Blob;
  fileName: string;
  title: string;
  alt?: string;
  licence: HubUploadLicence;
}

function headers(caller: HubCaller, extra?: Record<string, string>): Record<string, string> {
  return {
    authorization: `Bearer ${caller.config.apiKey}`,
    "x-image-hub-tenant": caller.tenant,
    "x-image-hub-actor": caller.actor,
    ...extra,
  };
}

/** Sends one request; returns the raw Response, or an `unreachable` failure. */
async function send(
  caller: HubCaller,
  path: string,
  init: RequestInit,
): Promise<HubResult<Response>> {
  const doFetch = caller.fetch ?? fetch;
  try {
    const res = await doFetch(`${caller.config.url}${path}`, init);
    return { ok: true, value: res };
  } catch (cause) {
    return {
      ok: false,
      code: "unreachable",
      message: cause instanceof Error ? cause.message : "The image hub could not be reached.",
    };
  }
}

/** Turns a non-2xx Response into the hub's error, or a generic one if the body is not the envelope. */
async function failure(
  res: Response,
): Promise<{ ok: false; code: string; message: string; status: number }> {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;
  const code = typeof body?.error?.code === "string" ? body.error.code : "http_error";
  const message =
    typeof body?.error?.message === "string"
      ? body.error.message
      : `The image hub answered ${res.status}.`;
  return { ok: false, code, message, status: res.status };
}

async function json<T>(caller: HubCaller, path: string, init: RequestInit): Promise<HubResult<T>> {
  const sent = await send(caller, path, init);
  if (!sent.ok) return sent;
  if (!sent.value.ok) return failure(sent.value);
  return { ok: true, value: (await sent.value.json()) as T };
}

function assetPath(id: string): string {
  return `/v1/assets/${encodeURIComponent(id)}`;
}

/** `GET /v1/assets` — newest first, keyset paged by `nextCursor`. */
export function searchAssets(
  caller: HubCaller,
  params: SearchParams = {},
): Promise<HubResult<HubPage>> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return json<HubPage>(caller, `/v1/assets${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: headers(caller),
  });
}

/** `GET /v1/assets/{id}` — includes `usages`. */
export function getAsset(caller: HubCaller, id: string): Promise<HubResult<HubAsset>> {
  return json<HubAsset>(caller, assetPath(id), { method: "GET", headers: headers(caller) });
}

/**
 * `GET /v1/assets/{id}/content` — the raw Response on success, so a caller can stream the body
 * (the content route) or buffer it (the server copy) without this module choosing for it.
 */
export async function getAssetContent(caller: HubCaller, id: string): Promise<HubResult<Response>> {
  const sent = await send(caller, `${assetPath(id)}/content`, {
    method: "GET",
    headers: headers(caller),
  });
  if (!sent.ok) return sent;
  if (!sent.value.ok) return failure(sent.value);
  return sent;
}

/** `POST /v1/assets` (multipart). The hub sets status `PENDING_REVIEW` and source `UPLOAD`. */
export function uploadAsset(caller: HubCaller, input: UploadInput): Promise<HubResult<HubAsset>> {
  const form = new FormData();
  form.set("file", input.file, input.fileName);
  form.set("title", input.title);
  if (input.alt) form.set("alt", input.alt);
  form.set("licence", input.licence);
  form.set("rightsConfirmed", "true");
  return json<HubAsset>(caller, "/v1/assets", {
    method: "POST",
    headers: headers(caller),
    body: form,
  });
}

/** `POST /v1/assets/{id}/approve` (scope review). */
export function approveAsset(caller: HubCaller, id: string): Promise<HubResult<HubAsset>> {
  return json<HubAsset>(caller, `${assetPath(id)}/approve`, {
    method: "POST",
    headers: headers(caller),
  });
}

/** `POST /v1/assets/{id}/reject` (scope review). The hub refuses while the image has usages. */
export function rejectAsset(
  caller: HubCaller,
  id: string,
  reason: string,
): Promise<HubResult<HubAsset>> {
  return json<HubAsset>(caller, `${assetPath(id)}/reject`, {
    method: "POST",
    headers: headers(caller, { "content-type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
}

/** `POST /v1/assets/{id}/usages` — idempotent on (kind, externalId). */
export function recordUsage(
  caller: HubCaller,
  id: string,
  usage: { kind: HubUsageKind; externalId: string },
): Promise<HubResult<HubUsage>> {
  return json<HubUsage>(caller, `${assetPath(id)}/usages`, {
    method: "POST",
    headers: headers(caller, { "content-type": "application/json" }),
    body: JSON.stringify(usage),
  });
}

/** `DELETE /v1/assets/{id}/usages/{usageId}` — 204 on success. */
export async function deleteUsage(
  caller: HubCaller,
  id: string,
  usageId: string,
): Promise<HubResult<null>> {
  const sent = await send(caller, `${assetPath(id)}/usages/${encodeURIComponent(usageId)}`, {
    method: "DELETE",
    headers: headers(caller),
  });
  if (!sent.ok) return sent;
  if (!sent.value.ok) return failure(sent.value);
  return { ok: true, value: null };
}
