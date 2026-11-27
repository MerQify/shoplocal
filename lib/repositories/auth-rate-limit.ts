import type { getPrismaWs } from "@/lib/db";
import { ATTEMPT_RECORD_RETENTION_HOURS } from "@/lib/data-retention";

export const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const WINDOW_MS = AUTH_RATE_LIMIT_WINDOW_MS;
const MAX_ATTEMPTS = 5;

// Occasionally prune expired reservations and inactive lock rows.
const RETENTION_MS = ATTEMPT_RECORD_RETENTION_HOURS * 60 * 60 * 1000;
const SWEEP_PROBABILITY = 0.01;

/** SHA-256 of the caller's IP — see AuthenticationAttempt's schema comment for why hashed, not raw. */
async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Reserve the IP and optional account slots under PostgreSQL row locks. */
export async function checkAuthRateLimit(
  prisma: ReturnType<typeof getPrismaWs>,
  vendorId: string,
  ip: string,
  accountKey?: string,
): Promise<{ allowed: boolean }> {
  const ipHash = await hashIp(ip);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const attempts = tx.authenticationAttempt;
          // Upsert takes a row lock until commit. Always acquire the source lock before
          // the account lock. Readers at READ COMMITTED then see the preceding reservation.
          const lock = async (key: string) => {
            const id = JSON.stringify([vendorId, key]);
            const createdAt = new Date();
            await attempts.upsert({
              where: { id },
              create: { id, vendorId, ipHash: "reservation-lock", createdAt },
              update: { createdAt },
            });
          };
          await lock(ipHash);
          const since = new Date(Date.now() - WINDOW_MS);
          const count = await attempts.count({
            where: { vendorId, ipHash, createdAt: { gte: since } },
          });
          if (count >= MAX_ATTEMPTS) return { allowed: false };
          await attempts.create({ data: { vendorId, ipHash } });
          if (accountKey) {
            await lock(accountKey);
            const where = {
              vendorId,
              ipHash: accountKey,
              createdAt: { gte: new Date(Date.now() - 5 * WINDOW_MS) },
            };
            if ((await attempts.count({ where })) >= 10) return { allowed: false };
            await attempts.create({ data: { vendorId, ipHash: accountKey } });
          }
          if (Math.random() < SWEEP_PROBABILITY) {
            await attempts.deleteMany({
              where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
            });
          }
          return { allowed: true };
        },
        { isolationLevel: "ReadCommitted" },
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "P2034" && code !== "40001" && code !== "23505" && code !== "P2002") throw error;
    }
  }
  return { allowed: false };
}
