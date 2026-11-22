import type { getPrisma, getPrismaWs } from "@/lib/db";
import { RECOVERABLE_ORIGINS, RECOVERY_LINK_DAYS } from "@/lib/abandoned-checkout/recovery";
import { REVENUE_STATUSES } from "@/lib/order-status";

/**
 * #1554, rebuilt for #1732/#1733 — abandoned checkouts and their staff-controlled recoveries. Every
 * export takes its Prisma client and `vendorId` explicitly and reads no request context (CLAUDE.md,
 * repository layer); `lib/abandoned-checkouts-service.ts` is the request-scoped half.
 *
 * An abandoned checkout is an existing CANCELLED order whose cancellation reason
 * (`OrderStatusEvent.cancellationOrigin`, #1730) is one of `RECOVERABLE_ORIGINS`. Its own lines are
 * the basket snapshot. A `CheckoutRecovery` row exists only once staff have acted on it.
 *
 * Client choice (CLAUDE.md): every `updateMany` and every interactive transaction takes the
 * WebSocket client (`getPrismaWs()`); reads and singular writes take `getPrisma()`.
 */

type Db = ReturnType<typeof getPrisma>;
type DbWs = ReturnType<typeof getPrismaWs>;

const DAY_MS = 24 * 60 * 60 * 1000;

const recoverySelect = {
  id: true,
  status: true,
  emailCount: true,
  lastEmailedAt: true,
  tokenExpiresAt: true,
  restoredAt: true,
  recoveredAt: true,
  suppressReason: true,
  recoveredOrder: { select: { orderNumber: true } },
  discountCode: {
    select: {
      id: true,
      code: true,
      kind: true,
      value: true,
      minSubtotalPence: true,
      endsAt: true,
      isActive: true,
    },
  },
};

const abandonedSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  confirmationToken: true,
  guestEmail: true,
  totalPence: true,
  subtotalPence: true,
  deliveryFeePence: true,
  fulfilmentMethod: true,
  createdAt: true,
  user: { select: { email: true, name: true } },
  items: {
    select: {
      productId: true,
      productName: true,
      quantity: true,
      unitPricePence: true,
      lineTotalPence: true,
      product: {
        select: {
          isActive: true,
          basePrice: true,
          inventory: { select: { stockMode: true, quantity: true } },
          images: {
            orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
  },
  statusEvents: {
    where: { status: "CANCELLED" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { createdAt: true, cancellationOrigin: true },
  },
  checkoutRecovery: { select: recoverySelect },
};

export interface AbandonedLine {
  productId: string | null;
  productName: string;
  quantity: number;
  /** What the customer saw at checkout. */
  unitPricePence: number;
  lineTotalPence: number;
  /** Null when the product has been deleted since. */
  product: {
    isActive: boolean;
    currentPricePence: number;
    stockMode: string | null;
    stockQuantity: number | null;
    imageKey: string | null;
  } | null;
}

export interface RecoveryIncentive {
  id: string;
  code: string;
  kind: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";
  value: number;
  minSubtotalPence: number;
  endsAt: Date | null;
  isActive: boolean;
}

export interface RecoveryState {
  id: string;
  status: string;
  emailCount: number;
  lastEmailedAt: Date | null;
  tokenExpiresAt: Date | null;
  restoredAt: Date | null;
  recoveredAt: Date | null;
  recoveredOrderNumber: string | null;
  suppressReason: string | null;
  incentive: RecoveryIncentive | null;
}

export interface AbandonedCheckoutRow {
  orderId: string;
  orderNumber: string;
  userId: string | null;
  confirmationToken: string | null;
  /** The account's email for a member, the checkout email for a guest. */
  email: string | null;
  customerName: string | null;
  totalPence: number;
  subtotalPence: number;
  deliveryFeePence: number;
  isDelivery: boolean;
  items: AbandonedLine[];
  /** When the order was cancelled (the cancellation event). */
  abandonedAt: Date;
  origin: string | null;
  recovery: RecoveryState | null;
}

type Selected = {
  id: string;
  orderNumber: string;
  userId: string | null;
  confirmationToken: string | null;
  guestEmail: string | null;
  totalPence: number;
  subtotalPence: number;
  deliveryFeePence: number;
  fulfilmentMethod: string;
  createdAt: Date;
  user: { email: string; name: string | null } | null;
  items: {
    productId: string | null;
    productName: string;
    quantity: number;
    unitPricePence: number;
    lineTotalPence: number;
    product: {
      isActive: boolean;
      basePrice: number;
      inventory: { stockMode: string; quantity: number } | null;
      images: { storageKey: string }[];
    } | null;
  }[];
  statusEvents: { createdAt: Date; cancellationOrigin: string | null }[];
  checkoutRecovery: {
    id: string;
    status: string;
    emailCount: number;
    lastEmailedAt: Date | null;
    tokenExpiresAt: Date | null;
    restoredAt: Date | null;
    recoveredAt: Date | null;
    suppressReason: string | null;
    recoveredOrder: { orderNumber: string } | null;
    discountCode: RecoveryIncentive | null;
  } | null;
};

function toRecoveryState(r: NonNullable<Selected["checkoutRecovery"]>): RecoveryState {
  return {
    id: r.id,
    status: r.status,
    emailCount: r.emailCount,
    lastEmailedAt: r.lastEmailedAt,
    tokenExpiresAt: r.tokenExpiresAt,
    restoredAt: r.restoredAt,
    recoveredAt: r.recoveredAt,
    recoveredOrderNumber: r.recoveredOrder?.orderNumber ?? null,
    suppressReason: r.suppressReason,
    incentive: r.discountCode,
  };
}

export function toAbandonedRow(order: Selected): AbandonedCheckoutRow {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    confirmationToken: order.confirmationToken,
    email: order.user?.email ?? order.guestEmail,
    customerName: order.user?.name ?? null,
    totalPence: order.totalPence,
    subtotalPence: order.subtotalPence,
    deliveryFeePence: order.deliveryFeePence,
    isDelivery: order.fulfilmentMethod === "DELIVERY",
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPricePence: item.unitPricePence,
      lineTotalPence: item.lineTotalPence,
      product: item.product
        ? {
            isActive: item.product.isActive,
            currentPricePence: item.product.basePrice,
            stockMode: item.product.inventory?.stockMode ?? null,
            stockQuantity: item.product.inventory?.quantity ?? null,
            imageKey: item.product.images[0]?.storageKey ?? null,
          }
        : null,
    })),
    abandonedAt: order.statusEvents[0]?.createdAt ?? order.createdAt,
    origin: order.statusEvents[0]?.cancellationOrigin ?? null,
    recovery: order.checkoutRecovery ? toRecoveryState(order.checkoutRecovery) : null,
  };
}

/** R4 — cancelled before payment for a recoverable reason. Never STAFF, never unrecorded. */
export function abandonedWhere(vendorId: string) {
  return {
    vendorId,
    status: "CANCELLED" as const,
    statusEvents: {
      some: {
        status: "CANCELLED" as const,
        cancellationOrigin: { in: [...RECOVERABLE_ORIGINS] },
      },
    },
  };
}

/** Abandoned checkouts placed since `since`, newest first, at most 200. */
export async function listAbandonedCheckouts(
  prisma: Db,
  vendorId: string,
  since: Date,
): Promise<AbandonedCheckoutRow[]> {
  const orders = await prisma.order.findMany({
    where: { ...abandonedWhere(vendorId), createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: abandonedSelect,
  });
  return (orders as unknown as Selected[]).map(toAbandonedRow);
}

/** One abandoned checkout of this store, or null (not this store's, or not abandoned). */
export async function findAbandonedCheckout(
  prisma: Db,
  vendorId: string,
  orderNumber: string,
): Promise<AbandonedCheckoutRow | null> {
  const order = await prisma.order.findFirst({
    where: { ...abandonedWhere(vendorId), orderNumber },
    select: abandonedSelect,
  });
  return order ? toAbandonedRow(order as unknown as Selected) : null;
}

/** The abandoned checkout a restore-link token belongs to (by its hash), or null. */
export async function findAbandonedCheckoutByTokenHash(
  prisma: Db,
  vendorId: string,
  tokenHash: string,
): Promise<AbandonedCheckoutRow | null> {
  const order = await prisma.order.findFirst({
    where: { ...abandonedWhere(vendorId), checkoutRecovery: { is: { tokenHash } } },
    select: abandonedSelect,
  });
  return order ? toAbandonedRow(order as unknown as Selected) : null;
}

/** R5 — each customer's paid orders placed after `since`, newest first. */
export async function listLaterPaidOrders(
  prisma: Db,
  vendorId: string,
  userIds: string[],
  since: Date,
): Promise<{ userId: string; orderNumber: string; createdAt: Date }[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.order.findMany({
    where: {
      vendorId,
      userId: { in: userIds },
      status: { in: [...REVENUE_STATUSES] },
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { userId: true, orderNumber: true, createdAt: true },
  });
  return rows.flatMap((r) =>
    r.userId ? [{ userId: r.userId, orderNumber: r.orderNumber, createdAt: r.createdAt }] : [],
  );
}

/** R11 — the store's active bundles with their items. */
export async function listActiveBundles(
  prisma: Db,
  vendorId: string,
): Promise<{ id: string; name: string; items: { productId: string; quantity: number }[] }[]> {
  return prisma.bundle.findMany({
    where: { vendorId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, items: { select: { productId: true, quantity: true } } },
  });
}

/** The recovery for an abandoned order, created on the first staff action (never on a view). */
export async function ensureRecovery(
  prisma: Db,
  vendorId: string,
  orderId: string,
): Promise<{ id: string; status: string; emailCount: number }> {
  return prisma.checkoutRecovery.upsert({
    where: { orderId },
    create: { vendorId, orderId },
    update: {},
    select: { id: true, status: true, emailCount: true },
  });
}

export type RecoveryEventKind =
  | "REVIEWED"
  | "INCENTIVE_ALLOCATED"
  | "INCENTIVE_REMOVED"
  | "EMAIL_SENT"
  | "EMAIL_RESENT"
  | "RESTORED"
  | "RECOVERED"
  | "SUPPRESSED"
  | "UNSUPPRESSED";

/**
 * Moves a recovery between statuses with a compare-and-set on its current status, and records the
 * event in the same transaction. False when the recovery was not in one of `from` (someone else
 * acted first, or the move is not allowed).
 */
export async function transitionRecovery(
  prisma: DbWs,
  vendorId: string,
  input: {
    recoveryId: string;
    from: readonly ("PENDING" | "REVIEWED" | "EMAIL_SENT" | "SUPPRESSED")[];
    to: "REVIEWED" | "SUPPRESSED";
    suppressReason?: string | null;
    event: RecoveryEventKind;
    actorUserId: string;
    note?: string | null;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.checkoutRecovery.updateMany({
      where: { id: input.recoveryId, vendorId, status: { in: [...input.from] } },
      data: {
        status: input.to,
        suppressReason: input.to === "SUPPRESSED" ? (input.suppressReason ?? null) : null,
      },
    });
    if (count === 0) return false;
    await tx.checkoutRecoveryEvent.create({
      data: {
        recoveryId: input.recoveryId,
        vendorId,
        kind: input.event,
        actorUserId: input.actorUserId,
        note: input.note ?? null,
      },
    });
    return true;
  });
}

/**
 * R10 — allocates a single-use, customer-locked code to the recovery, deactivating any code it
 * replaces, in one transaction. The code text is generated by the caller.
 */
export async function allocateRecoveryIncentive(
  prisma: DbWs,
  vendorId: string,
  input: {
    recoveryId: string;
    customerUserId: string;
    actorUserId: string;
    code: string;
    kind: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";
    value: number;
    minSubtotalPence: number;
    endsAt: Date;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.checkoutRecovery.findFirst({
      where: { id: input.recoveryId, vendorId },
      select: { discountCodeId: true, discountCode: { select: { code: true } } },
    });
    if (!current) throw new Error("Recovery not found");
    if (current.discountCodeId) {
      await tx.discountCode.updateMany({
        where: { id: current.discountCodeId, vendorId },
        data: { isActive: false },
      });
      await tx.checkoutRecoveryEvent.create({
        data: {
          recoveryId: input.recoveryId,
          vendorId,
          kind: "INCENTIVE_REMOVED",
          actorUserId: input.actorUserId,
          discountCode: current.discountCode?.code ?? null,
        },
      });
    }
    const code = await tx.discountCode.create({
      data: {
        vendorId,
        code: input.code,
        description: "Checkout recovery incentive",
        kind: input.kind,
        value: input.value,
        minSubtotalPence: input.minSubtotalPence,
        endsAt: input.endsAt,
        remainingRedemptions: 1,
        maxPerCustomer: 1,
        restrictedToUserId: input.customerUserId,
      },
      select: { id: true },
    });
    await tx.checkoutRecovery.update({
      where: { id: input.recoveryId },
      data: { discountCodeId: code.id },
    });
    await tx.checkoutRecoveryEvent.create({
      data: {
        recoveryId: input.recoveryId,
        vendorId,
        kind: "INCENTIVE_ALLOCATED",
        actorUserId: input.actorUserId,
        discountCode: input.code,
      },
    });
  });
}

/** Removes (deactivates and unlinks) the recovery's incentive, if any. */
export async function removeRecoveryIncentive(
  prisma: DbWs,
  vendorId: string,
  input: { recoveryId: string; actorUserId: string },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.checkoutRecovery.findFirst({
      where: { id: input.recoveryId, vendorId },
      select: { discountCodeId: true, discountCode: { select: { code: true } } },
    });
    if (!current?.discountCodeId) return false;
    await tx.discountCode.updateMany({
      where: { id: current.discountCodeId, vendorId },
      data: { isActive: false },
    });
    await tx.checkoutRecovery.update({
      where: { id: input.recoveryId },
      data: { discountCodeId: null },
    });
    await tx.checkoutRecoveryEvent.create({
      data: {
        recoveryId: input.recoveryId,
        vendorId,
        kind: "INCENTIVE_REMOVED",
        actorUserId: input.actorUserId,
        discountCode: current.discountCode?.code ?? null,
      },
    });
    return true;
  });
}

/**
 * R18 — claims a send BEFORE the email goes: a compare-and-set on `emailCount` (n → n + 1), refused
 * for a suppressed or recovered checkout, storing the fresh token hash and its expiry, plus the
 * event, in one transaction. Two concurrent sends expect the same `n`, so exactly one wins.
 */
export async function claimRecoverySend(
  prisma: DbWs,
  vendorId: string,
  input: {
    recoveryId: string;
    expectedEmailCount: number;
    tokenHash: string;
    actorUserId: string;
    discountCode: string | null;
    now: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.checkoutRecovery.updateMany({
      where: {
        id: input.recoveryId,
        vendorId,
        emailCount: input.expectedEmailCount,
        status: { notIn: ["SUPPRESSED", "RECOVERED"] },
      },
      data: {
        emailCount: input.expectedEmailCount + 1,
        status: "EMAIL_SENT",
        lastEmailedAt: input.now,
        tokenHash: input.tokenHash,
        tokenExpiresAt: new Date(input.now.getTime() + RECOVERY_LINK_DAYS * DAY_MS),
      },
    });
    if (count === 0) return false;
    await tx.checkoutRecoveryEvent.create({
      data: {
        recoveryId: input.recoveryId,
        vendorId,
        kind: input.expectedEmailCount === 0 ? "EMAIL_SENT" : "EMAIL_RESENT",
        actorUserId: input.actorUserId,
        discountCode: input.discountCode,
      },
    });
    return true;
  });
}

/** R21 — records a restore-link use. */
export async function recordRecoveryRestored(
  prisma: DbWs,
  vendorId: string,
  input: { recoveryId: string; now: Date },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.checkoutRecovery.updateMany({
      where: { id: input.recoveryId, vendorId },
      data: { restoredAt: input.now },
    });
    await tx.checkoutRecoveryEvent.create({
      data: { recoveryId: input.recoveryId, vendorId, kind: "RESTORED" },
    });
  });
}

/** Minimal shape of the transaction client `confirmPayment` hands over. */
export type RecoveryTx = {
  checkoutRecovery: {
    findFirst(args: never): Promise<{ id: string } | null>;
    updateMany(args: never): Promise<{ count: number }>;
  };
  checkoutRecoveryEvent: { create(args: never): Promise<unknown> };
};

/**
 * R22 — called INSIDE `confirmPayment`'s transaction, after its own compare-and-set succeeded, so
 * a duplicate or delayed webhook (which confirms nothing) never reaches here. The paying customer's
 * newest EMAIL_SENT recovery at this store, emailed within `RECOVERY_LINK_DAYS`, becomes RECOVERED.
 * A guest order, or no such recovery, changes nothing.
 */
export async function markRecoveredInTransaction(
  tx: RecoveryTx,
  vendorId: string,
  paid: { orderId: string; userId: string | null; now: Date },
): Promise<boolean> {
  if (!paid.userId) return false;
  const recovery = await tx.checkoutRecovery.findFirst({
    where: {
      vendorId,
      status: "EMAIL_SENT",
      orderId: { not: paid.orderId },
      order: { userId: paid.userId },
      lastEmailedAt: { gte: new Date(paid.now.getTime() - RECOVERY_LINK_DAYS * DAY_MS) },
    },
    orderBy: { lastEmailedAt: "desc" },
    select: { id: true },
  } as never);
  if (!recovery) return false;
  const { count } = await tx.checkoutRecovery.updateMany({
    where: { id: recovery.id, vendorId, status: "EMAIL_SENT" },
    data: { status: "RECOVERED", recoveredOrderId: paid.orderId, recoveredAt: paid.now },
  } as never);
  if (count === 0) return false;
  await tx.checkoutRecoveryEvent.create({
    data: { recoveryId: recovery.id, vendorId, kind: "RECOVERED" },
  } as never);
  return true;
}
