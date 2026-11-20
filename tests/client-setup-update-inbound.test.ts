import { describe, expect, it } from "vitest";
import { updateInboundAddressSchema } from "@/lib/client-setup/form-state";

describe("updateInboundAddressSchema", () => {
  it("accepts valid vendorId, id, and comma-separated forwardTo targets", () => {
    const result = updateInboundAddressSchema.safeParse({
      vendorId: "v1",
      id: "addr-1",
      forwardTo: "team1@domain.test, team2@domain.test",
      purpose: "SUPPORT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when forwardTo has invalid email syntax", () => {
    const result = updateInboundAddressSchema.safeParse({
      vendorId: "v1",
      id: "addr-1",
      forwardTo: "invalid-email, team2@domain.test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when forwardTo is empty", () => {
    const result = updateInboundAddressSchema.safeParse({
      vendorId: "v1",
      id: "addr-1",
      forwardTo: "   ",
    });
    expect(result.success).toBe(false);
  });
});
