"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button that disables itself while its form is submitting (#1589).
 *
 * Stops a second click before it is sent. It is not what makes a repeat safe —
 * `resumePayment` writes nothing and `cancelOrder` restores the basket only after
 * its own compare-and-set cancel — but it keeps the shopper from seeing the
 * effects of a double submit at all.
 */
export function PendingSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending ? "true" : undefined}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
