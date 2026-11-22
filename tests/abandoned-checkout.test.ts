import { describe, expect, it, vi } from "vitest";
import {
  isOfferableCode,
  reminderBlock,
  REMINDER_BLOCK_COPY,
  REMINDER_WINDOW_DAYS,
} from "@/lib/abandoned-checkout/eligibility";
import {
  buildRecoveryEmail,
  codeBenefit,
  NOT_CHARGED_SENTENCE,
  type RecoveryCode,
} from "@/lib/abandoned-checkout/email";
import {
  basketAtTodaysPrices,
  PREVIEW_RESTORE_PATH,
  previewRecoveryEmail,
  REMIND_COPY,
  sendRecoveryEmail,
  type RemindDeps,
  type StoreCode,
} from "@/lib/abandoned-checkout/remind";
import type { NotificationMessage } from "@/lib/notifications/dispatch";
import type {
  AbandonedCheckoutRow,
  AbandonedLine,
  RecoveryState,
} from "@/lib/repositories/abandoned-checkouts";

/** #1554, extended for #1733 — eligibility, the recovery email, Preview and Send. */

const NOW = new Date("2026-11-13T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const eligible = {
  abandonedAt: new Date(NOW.getTime() - DAY),
  userId: "user-1" as string | null,
  email: "sam@example.com" as string | null,
  hasConsent: true,
  emailCount: 0,
  status: null as string | null,
};

describe("reminderBlock (#1554 R2, #1733 R17/R18)", () => {
  it("an opted-in member within the window may be emailed", () => {
    expect(reminderBlock(eligible, NOW)).toBeNull();
  });

  it.each([
    ["already sent", { emailCount: 1 }, "already-sent"],
    ["a guest", { userId: null }, "guest"],
    ["no email", { email: null }, "no-email"],
    ["no consent", { hasConsent: false }, "no-consent"],
    [
      "too old",
      { abandonedAt: new Date(NOW.getTime() - (REMINDER_WINDOW_DAYS + 1) * DAY) },
      "too-old",
    ],
    ["suppressed", { status: "SUPPRESSED" }, "suppressed"],
    ["recovered", { status: "RECOVERED" }, "recovered"],
  ] as const)("%s is blocked", (_label, change, reason) => {
    expect(reminderBlock({ ...eligible, ...change }, NOW)).toBe(reason);
    expect(REMINDER_BLOCK_COPY[reason]).toBeTruthy();
  });

  it("a second send needs explicit confirmation, and still obeys consent", () => {
    const sent = { ...eligible, emailCount: 1, status: "EMAIL_SENT" };
    expect(reminderBlock(sent, NOW, { confirmResend: true })).toBeNull();
    expect(reminderBlock({ ...sent, hasConsent: false }, NOW, { confirmResend: true })).toBe(
      "no-consent",
    );
  });

  it("suppressed wins over a confirmed resend", () => {
    expect(
      reminderBlock({ ...eligible, emailCount: 1, status: "SUPPRESSED" }, NOW, {
        confirmResend: true,
      }),
    ).toBe("suppressed");
  });
});

describe("isOfferableCode (R3)", () => {
  const base = { isActive: true, startsAt: new Date(0), endsAt: null, remainingRedemptions: null };
  it.each([
    ["active and open", {}, true],
    ["inactive", { isActive: false }, false],
    ["not started", { startsAt: new Date(NOW.getTime() + DAY) }, false],
    ["ended", { endsAt: new Date(NOW.getTime() - 1) }, false],
    ["used up", { remainingRedemptions: 0 }, false],
    ["uses left", { remainingRedemptions: 3 }, true],
  ] as const)("%s → %s", (_label, change, expected) => {
    expect(isOfferableCode({ ...base, ...change }, NOW)).toBe(expected);
  });
});

const emailItems = [
  {
    productName: "Basmati <Rice>",
    quantity: 2,
    lineTotalPence: 1198,
    imageUrl: "https://cdn.test/rice.webp",
    available: true,
  },
  { productName: "Chana Dal", quantity: 1, lineTotalPence: 249, available: false },
];

describe("buildRecoveryEmail (#1554 R4, #1733 R16)", () => {
  const input = {
    storeName: "Corner Shop",
    firstName: "Sam",
    items: emailItems,
    totalPence: 1198,
    orderHref: "https://s.test/recover/tok",
    preferencesHref: "https://s.test/account/data",
    code: null,
  };

  it("lists items with images, today's total, the not-charged sentence, one button and the opt-out", () => {
    const { subject, html, text } = buildRecoveryEmail(input);
    expect(subject).toBe("Your basket is waiting for you");
    expect(html).toContain("Hi Sam,");
    expect(html).toContain("Basmati &lt;Rice&gt;");
    expect(html).toContain('src="https://cdn.test/rice.webp"');
    expect(html).toContain("£11.98");
    expect(html).toContain("No longer available");
    expect(text).toContain(NOT_CHARGED_SENTENCE);
    expect(html.match(/Return to your basket/g)).toHaveLength(1);
    expect(html).toContain('href="https://s.test/recover/tok"');
    expect(html).toContain("Stop marketing emails");
  });

  it("uses no false urgency or scarcity (CPRs, DMCC Act 2024)", () => {
    const text = buildRecoveryEmail(input).html.toLowerCase();
    for (const banned of [
      "hurry",
      "last chance",
      "only ",
      "left in stock",
      "expires in",
      "act now",
      "people are",
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it("never renders a non-https image", () => {
    const { html } = buildRecoveryEmail({
      ...input,
      items: [{ ...emailItems[0], imageUrl: "javascript:alert(1)" }],
    });
    expect(html).not.toContain("<img");
  });

  it.each([
    [{ kind: "PERCENTAGE", value: 1000 }, "10% off"],
    [{ kind: "PERCENTAGE", value: 1250 }, "12.5% off"],
    [{ kind: "FIXED_AMOUNT", value: 500 }, "£5.00 off"],
    [{ kind: "FREE_DELIVERY", value: 0 }, "free delivery"],
  ] as const)("code %o reads %s", (change, benefit) => {
    expect(codeBenefit({ code: "X", minSubtotalPence: 0, endsAt: null, ...change })).toBe(benefit);
  });

  it("a code adds its real benefit, conditions and end date, escaped", () => {
    const code: RecoveryCode = {
      code: "BACK<10>",
      kind: "PERCENTAGE",
      value: 1000,
      minSubtotalPence: 2000,
      endsAt: new Date("2026-11-20T12:00:00.000Z"),
    };
    const { subject, html } = buildRecoveryEmail({ ...input, code });
    expect(subject).toBe("Your basket is waiting for you (10% off inside)");
    expect(html).toContain("BACK&lt;10&gt;");
    expect(html).toContain("on orders over £20.00, until 20 November");
  });

  it("without a canonical host there is no button and the opt-out says reply", () => {
    const { html } = buildRecoveryEmail({ ...input, orderHref: null, preferencesHref: null });
    expect(html).not.toContain("Return to your basket");
    expect(html).toContain("Reply to this email to stop marketing emails.");
  });
});

function line(overrides: Partial<AbandonedLine> = {}): AbandonedLine {
  return {
    productId: "p-1",
    productName: "Basmati Rice",
    quantity: 2,
    unitPricePence: 599,
    lineTotalPence: 1198,
    product: {
      isActive: true,
      currentPricePence: 649,
      stockMode: "TRACKED",
      stockQuantity: 10,
      imageKey: "products/rice.webp",
    },
    ...overrides,
  };
}

function recovery(overrides: Partial<RecoveryState> = {}): RecoveryState {
  return {
    id: "rec-1",
    status: "REVIEWED",
    emailCount: 0,
    lastEmailedAt: null,
    tokenExpiresAt: null,
    restoredAt: null,
    recoveredAt: null,
    recoveredOrderNumber: null,
    suppressReason: null,
    incentive: null,
    ...overrides,
  };
}

function row(overrides: Partial<AbandonedCheckoutRow> = {}): AbandonedCheckoutRow {
  return {
    orderId: "order-1",
    orderNumber: "SHO-1",
    userId: "user-1",
    confirmationToken: null,
    email: "sam@example.com",
    customerName: "Sam Shopper",
    totalPence: 1447,
    subtotalPence: 1447,
    deliveryFeePence: 399,
    isDelivery: true,
    items: [
      line(),
      line({
        productId: null,
        productName: "Gone Dal",
        quantity: 1,
        unitPricePence: 249,
        product: null,
      }),
    ],
    abandonedAt: new Date(NOW.getTime() - DAY),
    origin: "PAYMENT_EXPIRED",
    recovery: null,
    ...overrides,
  };
}

describe("basketAtTodaysPrices (#1733 R16)", () => {
  it("prices at today's price, marks deleted products unavailable and leaves them out of the total", () => {
    const basket = basketAtTodaysPrices(row(), "https://cdn.test");
    expect(basket.items[0]).toMatchObject({
      lineTotalPence: 1298,
      imageUrl: "https://cdn.test/products/rice.webp",
      available: true,
    });
    expect(basket.items[1]).toMatchObject({ available: false, imageUrl: null });
    expect(basket.totalPence).toBe(1298);
  });
});

const CODE: StoreCode = {
  id: "code-1",
  code: "BACK10",
  kind: "PERCENTAGE",
  value: 1000,
  minSubtotalPence: 0,
  endsAt: null,
  startsAt: new Date(0),
  isActive: true,
  remainingRedemptions: null,
};

function deps(overrides: Partial<RemindDeps> = {}) {
  const sent: NotificationMessage[] = [];
  const order: string[] = [];
  const d: RemindDeps & { sent: NotificationMessage[]; order: string[] } = {
    sent,
    order,
    find: vi.fn(async () => row()),
    hasConsent: vi.fn(async () => true),
    listCodes: vi.fn(async () => [CODE, { ...CODE, id: "code-2", isActive: false }]),
    ensureRecovery: vi.fn(async () => ({ id: "rec-1", status: "PENDING", emailCount: 0 })),
    claim: vi.fn(async () => {
      order.push("claim");
      return true;
    }),
    newToken: vi.fn(async () => ({ token: "raw-token", hash: "hash-of-raw-token" })),
    loadStore: vi.fn(async () => ({
      sender: { name: "Corner Shop", email: "shop@s.test" },
      baseUrl: "https://s.test",
    })),
    send: vi.fn(async (m) => {
      order.push("send");
      sent.push(...m);
    }),
    now: () => NOW,
    cdnBaseUrl: "https://cdn.test",
    ...overrides,
  };
  return d;
}

const input = {
  orderNumber: "SHO-1",
  staffUserId: "staff-1",
  discountCodeId: null as string | null,
  confirmResend: false,
};

describe("sendRecoveryEmail (#1733 R17, R18)", () => {
  it("claims with the token HASH, then sends one email carrying the raw token's restore link", async () => {
    const d = deps();
    expect(await sendRecoveryEmail(input, d)).toEqual({ ok: true });
    expect(d.order).toEqual(["claim", "send"]);
    expect(d.claim).toHaveBeenCalledWith({
      recoveryId: "rec-1",
      expectedEmailCount: 0,
      tokenHash: "hash-of-raw-token",
      actorUserId: "staff-1",
      discountCode: null,
    });
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0]).toMatchObject({
      channel: "EMAIL",
      destination: "sam@example.com",
      sender: { name: "Corner Shop", email: "shop@s.test" },
      log: { audience: "CUSTOMER", event: "ABANDONED_CHECKOUT_REMINDER" },
    });
    expect(d.sent[0].body).toContain('href="https://s.test/recover/raw-token"');
  });

  it("uses the recovery's allocated incentive when no store code is chosen", async () => {
    const d = deps({
      find: vi.fn(async () =>
        row({
          recovery: recovery({
            incentive: {
              id: "c-9",
              code: "BACK-ABCDEFGH",
              kind: "FREE_DELIVERY",
              value: 0,
              minSubtotalPence: 0,
              endsAt: null,
              isActive: true,
            },
          }),
        }),
      ),
    });
    await sendRecoveryEmail(input, d);
    expect(d.claim).toHaveBeenCalledWith(
      expect.objectContaining({ discountCode: "BACK-ABCDEFGH" }),
    );
    expect(d.sent[0].subject).toContain("free delivery");
  });

  it("an offerable store code is recorded on the claim and appears in the email", async () => {
    const d = deps();
    await sendRecoveryEmail({ ...input, discountCodeId: "code-1" }, d);
    expect(d.claim).toHaveBeenCalledWith(expect.objectContaining({ discountCode: "BACK10" }));
    expect(d.sent[0].subject).toContain("10% off");
  });

  it.each(["code-2", "missing"])("code %s that cannot be offered sends nothing", async (id) => {
    const d = deps();
    expect(await sendRecoveryEmail({ ...input, discountCodeId: id }, d)).toEqual({
      ok: false,
      error: REMIND_COPY.badCode,
    });
    expect(d.claim).not.toHaveBeenCalled();
    expect(d.sent).toEqual([]);
  });

  it("a second send is refused without confirmation, and claims emailCount 1 → 2 with it", async () => {
    const sentRow = row({ recovery: recovery({ status: "EMAIL_SENT", emailCount: 1 }) });
    const d = deps({
      find: vi.fn(async () => sentRow),
      ensureRecovery: vi.fn(async () => ({ id: "rec-1", status: "EMAIL_SENT", emailCount: 1 })),
    });
    expect(await sendRecoveryEmail(input, d)).toEqual({
      ok: false,
      error: REMINDER_BLOCK_COPY["already-sent"],
    });
    expect(d.claim).not.toHaveBeenCalled();
    expect(await sendRecoveryEmail({ ...input, confirmResend: true }, d)).toEqual({ ok: true });
    expect(d.claim).toHaveBeenCalledWith(expect.objectContaining({ expectedEmailCount: 1 }));
  });

  it("losing the claim race (double click, second admin) sends nothing", async () => {
    const d = deps({ claim: vi.fn(async () => false) });
    expect(await sendRecoveryEmail(input, d)).toEqual({ ok: false, error: REMIND_COPY.raced });
    expect(d.sent).toEqual([]);
  });

  it.each([
    ["a guest", { userId: null }, "guest"],
    ["suppressed", { recovery: recovery({ status: "SUPPRESSED" }) }, "suppressed"],
    ["recovered", { recovery: recovery({ status: "RECOVERED" }) }, "recovered"],
    ["too old", { abandonedAt: new Date(NOW.getTime() - 8 * DAY) }, "too-old"],
  ] as const)("%s is refused server-side, before any claim", async (_l, change, reason) => {
    const d = deps({ find: vi.fn(async () => row(change as Partial<AbandonedCheckoutRow>)) });
    expect(await sendRecoveryEmail(input, d)).toEqual({
      ok: false,
      error: REMINDER_BLOCK_COPY[reason],
    });
    expect(d.claim).not.toHaveBeenCalled();
    expect(d.sent).toEqual([]);
  });

  it("consent withdrawn since the page loaded is refused", async () => {
    const d = deps({ hasConsent: vi.fn(async () => false) });
    expect(await sendRecoveryEmail(input, d)).toEqual({
      ok: false,
      error: REMINDER_BLOCK_COPY["no-consent"],
    });
  });

  it("another store's or a non-abandoned order is not found", async () => {
    const d = deps({ find: vi.fn(async () => null) });
    expect(await sendRecoveryEmail(input, d)).toEqual({ ok: false, error: REMIND_COPY.notFound });
  });
});

describe("previewRecoveryEmail (#1733 R15)", () => {
  it("builds exactly what Send builds, apart from the placeholder link, claiming and sending nothing", async () => {
    const d = deps();
    const preview = await previewRecoveryEmail(
      { orderNumber: "SHO-1", discountCodeId: "code-1" },
      d,
    );
    expect(d.claim).not.toHaveBeenCalled();
    expect(d.sent).toEqual([]);
    await sendRecoveryEmail({ ...input, discountCodeId: "code-1" }, d);
    if (!preview.ok) throw new Error("preview failed");
    expect(preview.to).toBe("sam@example.com");
    expect(preview.subject).toBe(d.sent[0].subject);
    expect(preview.html.replace(PREVIEW_RESTORE_PATH, "/recover/raw-token")).toBe(d.sent[0].body);
  });

  it("still previews a blocked checkout, saying why it can't be sent", async () => {
    const d = deps({ find: vi.fn(async () => row({ userId: null })) });
    const preview = await previewRecoveryEmail({ orderNumber: "SHO-1", discountCodeId: null }, d);
    expect(preview).toMatchObject({ ok: true, blockedReason: REMINDER_BLOCK_COPY.guest });
  });
});
