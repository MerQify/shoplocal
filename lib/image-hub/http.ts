/**
 * #1671 — the HTTP status a route handler answers for a failed library result. Pure, so both
 * `/api/admin/image-library/*` routes map the same code to the same status.
 */
export function libraryErrorStatus(result: { code: string; status?: number }): number {
  switch (result.code) {
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "validation":
      return 400;
    case "not_configured":
      return 503;
    case "unreachable":
      return 502;
    default:
      // A hub refusal keeps the hub's own status where it is a client error (409 duplicate, 422).
      return result.status && result.status >= 400 && result.status < 500 ? result.status : 502;
  }
}
