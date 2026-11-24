import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Staff products filter dropdown widths and layout stability", () => {
  const pageSource = read("app/(admin)/staff/products/page.tsx");

  it("selectClass includes w-full and truncate for uniform sizing and clean truncation", () => {
    expect(pageSource).toContain(
      'const selectClass =\n  "w-full truncate rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary";',
    );
  });

  it("assigns optimal fixed widths and shrink-0 to each filter dropdown label", () => {
    // Status
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-36`}");
    // Category
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-56`}");
    // Brand
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-44`}");
    // Restriction
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-40`}");
    // Stock
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-40`}");
    // Needs attention
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-44`}");
    // Sort
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-44`}");
    // Per page
    expect(pageSource).toContain("className={`${labelClass} shrink-0 w-24`}");
  });

  it("groups action buttons with shrink-0 to prevent awkward wrapping", () => {
    expect(pageSource).toContain('className="flex shrink-0 items-center gap-2"');
  });
});
