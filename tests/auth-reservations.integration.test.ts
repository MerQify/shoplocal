import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { expect, it } from "vitest";
import { checkAuthRateLimit } from "@/lib/repositories/auth-rate-limit";

// The disposable database must contain AuthenticationAttempt and a fixture vendor.
const connectionString = process.env.AUTH_LIMIT_TEST_DATABASE_URL;
const vendorId = process.env.AUTH_LIMIT_TEST_VENDOR_ID;
it.skipIf(!connectionString || !vendorId)(
  "reserves no more than five concurrent source slots",
  async () => {
    const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
    const source = crypto.randomUUID();
    try {
      const reserve = () => checkAuthRateLimit(prisma, vendorId!, source);
      const results = await Promise.all(Array.from({ length: 12 }, reserve));
      const admitted = results.filter((result) => result.allowed).length;
      expect(admitted).toBe(5);
      const accountKey = "account:" + crypto.randomUUID();
      const accountResults = await Promise.all(
        Array.from({ length: 14 }, () =>
          checkAuthRateLimit(prisma, vendorId!, crypto.randomUUID(), accountKey),
        ),
      );
      expect(accountResults.filter((result) => result.allowed)).toHaveLength(10);
      expect((await reserve()).allowed).toBe(false);
    } finally {
      await prisma.$disconnect();
    }
  },
  30000,
);
