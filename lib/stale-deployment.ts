/**
 * Deployment skew (#1664): a page loaded before a deploy keeps the OLD build's server-action ids
 * and chunk names. After the deploy, its next action or lazy chunk targets something the new build
 * no longer has, and the error boundary shows "Something went wrong" until the user reloads. A
 * reload is the whole fix, so the boundaries do it once, automatically.
 *
 * Matched on the messages the framework and the browser actually produce:
 *   - `Server Action "<id>" was not found on the server.` (Next's client UnrecognizedActionError)
 *   - `Failed to find Server Action. This request might be from an older or newer deployment.`
 *   - webpack's `ChunkLoadError` / `Loading chunk <n> failed` / `Loading CSS chunk <n> failed`
 *
 * Anything else, including every server render error (its message is redacted to a digest in
 * production), is NOT skew and keeps today's behaviour.
 */
const SKEW_PATTERNS: readonly RegExp[] = [
  /Server Action ".*" was not found on the server/i,
  /Failed to find Server Action/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
];

export function isStaleDeploymentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError" || error.name === "UnrecognizedActionError") return true;
  return SKEW_PATTERNS.some((p) => p.test(error.message));
}

/** sessionStorage key holding the time of the last automatic reload. */
export const STALE_RELOAD_KEY = "merqify:stale-deploy-reload-at";
/** A second skew error within this window means the reload did not help: stop, show the panel. */
export const STALE_RELOAD_WINDOW_MS = 30_000;

/**
 * Reloads once for a skew error and reports whether it did. Never loops: if the last automatic
 * reload was under `STALE_RELOAD_WINDOW_MS` ago, it does nothing. Storage that throws (private
 * mode, blocked site data) means no reload at all — a loop is worse than the error panel.
 */
export function reloadOnceForStaleDeployment(
  error: unknown,
  deps: {
    storage: Pick<Storage, "getItem" | "setItem">;
    reload: () => void;
    now?: () => number;
  },
): boolean {
  if (!isStaleDeploymentError(error)) return false;
  const now = (deps.now ?? Date.now)();
  try {
    const last = Number(deps.storage.getItem(STALE_RELOAD_KEY) ?? "0");
    if (now - last < STALE_RELOAD_WINDOW_MS) return false;
    deps.storage.setItem(STALE_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  deps.reload();
  return true;
}

/** The browser wiring the boundaries call from their effect. */
export function reloadIfStaleDeployment(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    return reloadOnceForStaleDeployment(error, {
      storage: window.sessionStorage,
      reload: () => window.location.reload(),
    });
  } catch {
    return false;
  }
}
