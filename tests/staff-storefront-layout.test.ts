import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Staff Storefront Responsive 2-Column Layout", () => {
  const pagePath = resolve(__dirname, "../app/(admin)/staff/storefront/page.tsx");
  const formPath = resolve(__dirname, "../components/staff/StorefrontConfigForm.tsx");
  const footerPath = resolve(__dirname, "../components/staff/FooterSettingsForms.tsx");

  it("page.tsx uses PageContainer width='wide' and passes slots to StorefrontConfigForm", () => {
    const content = readFileSync(pagePath, "utf-8");
    expect(content).toContain('<PageContainer width="wide">');
    expect(content).toContain("footerSlot=");
    expect(content).toContain("marketingSlot=");
    expect(content).toContain("reviewsSlot=");
  });

  it("StorefrontConfigForm.tsx implements a 12-column responsive layout with 7/5 column split", () => {
    const content = readFileSync(formPath, "utf-8");
    expect(content).toContain("grid grid-cols-1 lg:grid-cols-12 gap-8 items-start");
    expect(content).toContain("lg:col-span-7");
    expect(content).toContain("lg:col-span-5");
    // Verifies all forms and slots are integrated
    expect(content).toContain("saveBranding");
    expect(content).toContain("saveDeliveryRules");
    expect(content).toContain("{footerSlot}");
    expect(content).toContain("VendorLogoUploader");
    expect(content).toContain("VendorMarkUploader");
    expect(content).toContain("WhatsappQrUploader");
    expect(content).toContain("saveGridDensity");
    expect(content).toContain("saveCatalogueSettings");
    expect(content).toContain("saveSocialContact");
    expect(content).toContain("{marketingSlot}");
    expect(content).toContain("{reviewsSlot}");
  });

  it("FooterSettingsForms wraps each section in panel card styling", () => {
    const content = readFileSync(footerPath, "utf-8");
    expect(content).toContain("Footer contact");
    expect(content).toContain("Opening hours");
    expect(content).toContain("Holiday & closure dates");
    expect(content).toContain("rounded-2xl border border-black/10 bg-white p-6 shadow-sm");
  });
});
