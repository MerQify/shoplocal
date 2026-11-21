import { getPrisma } from "@/lib/db";
import {
  ASSISTANT_CONVERSATION_RETENTION_DAYS,
  ATTEMPT_RECORD_RETENTION_HOURS,
  SEARCH_QUERY_LOG_RETENTION_DAYS,
} from "@/lib/data-retention";

const BATCH_LIMIT = 5_000;
const HOUR_MS = 60 * 60 * 1000;

export async function sweepExpiredData(now = new Date()) {
  const prisma = getPrisma();
  const cutoff = (hours: number) => ({
    where: { createdAt: { lt: new Date(now.getTime() - hours * HOUR_MS) } },
    limit: BATCH_LIMIT,
  });
  const attempts = cutoff(ATTEMPT_RECORD_RETENTION_HOURS);
  return {
    searchQueries: (
      await prisma.searchQueryLog.deleteMany(cutoff(SEARCH_QUERY_LOG_RETENTION_DAYS * 24))
    ).count,
    assistantConversations: (
      await prisma.assistantConversation.deleteMany(
        cutoff(ASSISTANT_CONVERSATION_RETENTION_DAYS * 24),
      )
    ).count,
    authenticationAttempts: (await prisma.authenticationAttempt.deleteMany(attempts)).count,
    orderLookupAttempts: (await prisma.orderLookupAttempt.deleteMany(attempts)).count,
    discountCodeAttempts: (await prisma.discountCodeAttempt.deleteMany(attempts)).count,
    customerFeedbackAttempts: (await prisma.customerFeedbackAttempt.deleteMany(attempts)).count,
    listNormalisationAttempts: (await prisma.listNormalisationAttempt.deleteMany(attempts)).count,
  };
}
