import { getPrisma } from "@/lib/db";
import { getCurrentVendorId } from "@/lib/tenant";
import { getPaymentService } from "@/lib/payments";
import { findOrderPaymentState } from "@/lib/repositories/orders";
import { resumeOrderPayment, type ResumePaymentOutcome } from "@/lib/resume-payment";

/** Everything `resumeOrderPayment` can answer, plus "no such order for this vendor". */
export type ResumePaymentResult = ResumePaymentOutcome | { kind: "not-found" };

/**
 * The request-scoped facade for "Continue to payment" (#1589): the only place
 * `lib/resume-payment.ts`'s pure decision meets live clients, the same split as
 * `lib/payment-check-service.ts`.
 *
 * Vendor-scoped: the order and its stored session are loaded for the CURRENT
 * vendor. The caller authorizes first (`features/checkout/resume-payment.ts`
 * re-proves the capability token or ownership).
 *
 * Constructed fresh per call, never cached (CLAUDE.md).
 */
export function getResumePaymentService() {
  return {
    resume: async (orderNumber: string): Promise<ResumePaymentResult> => {
      const order = await findOrderPaymentState(
        getPrisma(),
        await getCurrentVendorId(),
        orderNumber,
      );
      if (!order) return { kind: "not-found" };

      return resumeOrderPayment(
        { retrieveSession: (sessionId) => getPaymentService().retrieveSession(sessionId) },
        order,
      );
    },
  };
}
