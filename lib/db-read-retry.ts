import type { PrismaNeonHttp } from "@prisma/adapter-neon";

/**
 * Retry a READ when the connection to Neon drops (#1666).
 *
 * WHY. On 2026-11-18 the AFC staging Worker logged `Error: Network connection lost.` (the Workers
 * runtime's error for a subrequest dropped mid-flight), and the owner kept seeing "Something went
 * wrong" on pages whose layout reads the database: `/staff` rendered the ROOT boundary, so the
 * `(admin)` layout's own reads failed. A second attempt almost always succeeds.
 *
 * WHERE. At the driver-adapter layer, wrapping `PrismaNeonHttp`'s `queryRaw`, so every client built
 * by `lib/db.ts`'s HTTP factories gets it — repositories, Better Auth's session lookup (through
 * `authDb`, which only hides `$transaction`), and the vendor/tenant lookups — without changing the
 * client's type. The WebSocket client (`getPrismaWs`) is deliberately NOT wrapped: it runs
 * interactive transactions, where a statement cannot be replayed on its own.
 *
 * WHAT IS RETRIED — and the part that must not drift:
 *   - Only a statement that is a plain `SELECT` (no `FOR UPDATE`/`FOR SHARE` lock). Prisma sends its
 *     writes as `INSERT … RETURNING`/`UPDATE … RETURNING` through the SAME `queryRaw` method, so the
 *     method name says nothing about safety; the SQL does. A write whose connection dropped has an
 *     UNKNOWN outcome — replaying it could double an order line or a stock movement — so a write
 *     always fails through to the caller exactly as before.
 *   - Only a connection-level failure: the runtime's dropped-connection messages, the Neon HTTP
 *     driver's `Error connecting to database` / `Server error (HTTP status 5xx)`, and the SQLSTATE
 *     connection classes (`08…`, `57P01`, `57P03`). A query error (bad column, constraint, timeout
 *     in the statement itself) is never retried.
 *   - At most `READ_RETRY_DELAYS_MS.length` extra attempts, with a short pause before each.
 *
 * Every retry logs one line naming the attempt and the reason — never the SQL or its arguments.
 */

type HttpAdapterFactory = Pick<PrismaNeonHttp, "provider" | "adapterName" | "connect">;
type HttpAdapter = Awaited<ReturnType<PrismaNeonHttp["connect"]>>;
type SqlQuery = Parameters<HttpAdapter["queryRaw"]>[0];

/** Pause before each retry; two retries, under half a second in total. */
export const READ_RETRY_DELAYS_MS: readonly number[] = [100, 300];

const TRANSIENT_MESSAGES: readonly RegExp[] = [
  /Network connection lost/i,
  /fetch failed/i,
  /Error connecting to database/i,
  /Server error \(HTTP status 5\d\d\)/i,
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|socket hang up/i,
  /Connection terminated/i,
  /terminating connection/i,
];

/** SQLSTATE classes that describe the connection, not the statement. */
const TRANSIENT_SQLSTATE = /^(08...|57P01|57P03)$/;

/** Is `sql` a plain read that is safe to send twice? */
export function isRetryableRead(sql: string): boolean {
  const s = sql.trimStart();
  if (!/^select\b/i.test(s)) return false;
  return !/\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/i.test(s);
}

/** Does `error` (or anything in its `cause`/`sourceError` chain) describe a dropped connection? */
export function isTransientConnectionError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as {
      message?: unknown;
      code?: unknown;
      cause?: unknown;
      sourceError?: unknown;
    };
    if (typeof e.code === "string" && TRANSIENT_SQLSTATE.test(e.code)) return true;
    if (
      typeof e.message === "string" &&
      TRANSIENT_MESSAGES.some((p) => p.test(e.message as string))
    )
      return true;
    current = e.cause ?? e.sourceError;
  }
  return false;
}

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 120);
}

export async function runReadWithRetry<T>(
  sql: string,
  run: () => Promise<T>,
  deps: {
    delays?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    log?: (line: string) => void;
  } = {},
): Promise<T> {
  const delays = deps.delays ?? READ_RETRY_DELAYS_MS;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? ((line: string) => console.warn(line));
  const retryable = isRetryableRead(sql);

  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!retryable || attempt >= delays.length || !isTransientConnectionError(error)) throw error;
      log(`[db-retry] read retry ${attempt + 1}/${delays.length} after: ${reasonOf(error)}`);
      await sleep(delays[attempt]);
    }
  }
}

/**
 * Wraps an HTTP adapter factory so its adapter's `queryRaw` retries reads (see above). Every other
 * member is forwarded unchanged and bound to the real adapter.
 */
export function withReadRetry<F extends HttpAdapterFactory>(factory: F): F {
  return new Proxy(factory, {
    get(target, prop) {
      if (prop === "connect") {
        return async () => {
          const adapter = await target.connect();
          return new Proxy(adapter, {
            get(a, p) {
              if (p === "queryRaw") {
                return (query: SqlQuery) => runReadWithRetry(query.sql, () => a.queryRaw(query));
              }
              const value = Reflect.get(a, p, a);
              return typeof value === "function" ? value.bind(a) : value;
            },
          });
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
