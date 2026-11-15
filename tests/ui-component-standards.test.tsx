import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, type BadgeVariant, type BadgeTone, type BadgeSize } from "@/components/ui/Badge";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui/Button";
import { buttonClass } from "@/lib/form-classes";

describe("UI Component Standards & Sizing Tokens (#1608)", () => {
  const tokensPath = resolve(__dirname, "../design-system/tokens/components.json");

  it("design-system/tokens/components.json exists and contains canonical token schema", () => {
    expect(existsSync(tokensPath)).toBe(true);
    const content = JSON.parse(readFileSync(tokensPath, "utf8"));

    expect(content.version).toBe("1.0.0");
    expect(content.controlHeights).toBeDefined();
    expect(content.spacingScale).toBeDefined();
    expect(content.cardPadding).toBeDefined();
    expect(content.badgeDimensions).toBeDefined();
    expect(content.shapeRadii).toBeDefined();
    expect(content.typographyHierarchy).toBeDefined();
  });

  it("control heights align with 4px grid and accessibility touch targets", () => {
    const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
    const { sm, md, tap, lg } = tokens.controlHeights;

    expect(sm.valuePx).toBe(32);
    expect(md.valuePx).toBe(40);
    expect(tap.valuePx).toBe(44); // WCAG 2.5.5 AAA touch target
    expect(lg.valuePx).toBe(48);

    // Multiples of 4
    expect(sm.valuePx % 4).toBe(0);
    expect(md.valuePx % 4).toBe(0);
    expect(tap.valuePx % 4).toBe(0);
    expect(lg.valuePx % 4).toBe(0);
  });

  it("spacing scale is strictly 4px-grid based", () => {
    const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
    expect(tokens.spacingScale.baseGridPx).toBe(4);

    const steps = tokens.spacingScale.steps;
    for (const [, def] of Object.entries(steps) as [string, { px: number }][]) {
      expect(def.px % 4).toBe(0);
    }
  });

  it("shape radii enforce non-aliased radius scale", () => {
    const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
    expect(tokens.shapeRadii.controls.tailwindClass).toBe("rounded-xl");
    expect(tokens.shapeRadii.surfaces.tailwindClass).toBe("rounded-2xl");
    expect(tokens.shapeRadii.pills.tailwindClass).toBe("rounded-full");
  });
});

describe("Badge Primitive Component (#1608)", () => {
  it("renders a semantic rounded-full pill span", () => {
    const html = renderToStaticMarkup(<Badge>Halal</Badge>);
    expect(html).toContain("<span");
    expect(html).toContain("rounded-full");
    expect(html).toContain("Halal");
  });

  it("renders all badge variants with contrast-compliant classes", () => {
    const variants: BadgeVariant[] = ["action", "primary", "accent", "danger", "muted", "outline"];
    for (const variant of variants) {
      const htmlFill = renderToStaticMarkup(
        <Badge variant={variant} tone="fill">
          {variant}
        </Badge>,
      );
      const htmlTint = renderToStaticMarkup(
        <Badge variant={variant} tone="tint">
          {variant}
        </Badge>,
      );

      expect(htmlFill).toContain(variant);
      expect(htmlTint).toContain(variant);

      // Verify fill tone uses solid white text or dark text
      if (variant === "action") {
        expect(htmlFill).toContain("bg-action");
        expect(htmlFill).toContain("text-white");
        expect(htmlTint).toContain("bg-action-tint");
        expect(htmlTint).toContain("text-action");
      } else if (variant === "primary") {
        expect(htmlFill).toContain("bg-primary");
        expect(htmlFill).toContain("text-white");
        expect(htmlTint).toContain("bg-surface-muted");
        expect(htmlTint).toContain("text-primary");
      } else if (variant === "accent") {
        expect(htmlFill).toContain("bg-accent");
        expect(htmlFill).toContain("text-white");
        expect(htmlTint).toContain("bg-accent-tint");
        expect(htmlTint).toContain("text-accent");
      } else if (variant === "danger") {
        expect(htmlFill).toContain("bg-danger");
        expect(htmlFill).toContain("text-white");
        expect(htmlTint).toContain("bg-danger-tint");
        expect(htmlTint).toContain("text-danger");
      }
    }
  });

  it("supports compact (sm) and standard (md) badge sizing", () => {
    const smHtml = renderToStaticMarkup(<Badge size="sm">Compact</Badge>);
    const mdHtml = renderToStaticMarkup(<Badge size="md">Standard</Badge>);

    expect(smHtml).toContain("text-[10px]");
    expect(smHtml).toContain("px-2");
    expect(smHtml).toContain("py-0.5");

    expect(mdHtml).toContain("text-xs");
    expect(mdHtml).toContain("px-2.5");
    expect(mdHtml).toContain("py-0.5");
  });

  it("appends custom class names cleanly", () => {
    const html = renderToStaticMarkup(<Badge className="custom-shadow mt-1">Badge</Badge>);
    expect(html).toContain("custom-shadow");
    expect(html).toContain("mt-1");
  });
});

describe("Button Primitive Component (#1608)", () => {
  it("preserves backward compatibility for variant='action' (buttonClass)", () => {
    const html = renderToStaticMarkup(<Button variant="action">Submit</Button>);
    expect(html).toContain(buttonClass);
  });

  it("preserves backward compatibility for variant='primary'", () => {
    const html = renderToStaticMarkup(<Button variant="primary">Save Product</Button>);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-white");
  });

  it("supports extended variants: secondary, outline, danger, ghost", () => {
    const variants: ButtonVariant[] = ["secondary", "outline", "danger", "ghost"];
    for (const v of variants) {
      const html = renderToStaticMarkup(<Button variant={v}>{v}</Button>);
      expect(html).toContain("<button");
      expect(html).toContain(v);

      if (v === "secondary") expect(html).toContain("bg-surface-muted");
      if (v === "outline") expect(html).toContain("border-action");
      if (v === "danger") expect(html).toContain("bg-danger");
      if (v === "ghost") expect(html).toContain("text-primary");
    }
  });

  it("supports standard size steps: sm, md, lg, tap", () => {
    const sizes: ButtonSize[] = ["sm", "md", "lg", "tap"];
    for (const s of sizes) {
      const html = renderToStaticMarkup(
        <Button variant="secondary" size={s}>
          Click
        </Button>,
      );
      if (s === "sm") expect(html).toContain("h-8");
      if (s === "md") expect(html).toContain("h-10");
      if (s === "lg") expect(html).toContain("h-12");
      if (s === "tap") expect(html).toContain("min-h-tap");
    }
  });

  it("enforces keyboard focus-visible indicator ring", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Accessible</Button>);
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-action");
    expect(html).toContain("focus-visible:ring-offset-2");
  });
});

describe("Card Component Integration (#1608)", () => {
  it("BundleCard.tsx composes Card component rather than duplicating raw card classes", () => {
    const bundleCardCode = readFileSync(
      resolve(__dirname, "../components/bundle/BundleCard.tsx"),
      "utf8",
    );
    expect(bundleCardCode).toContain('import { Card } from "@/components/ui/Card"');
    expect(bundleCardCode).toContain('<Card variant="product">');
    expect(bundleCardCode).not.toContain(
      '<div className="skew-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-action/50">',
    );
  });

  it("ProductCard.tsx uses Badge component for top badges", () => {
    const productCardCode = readFileSync(
      resolve(__dirname, "../components/product/ProductCard.tsx"),
      "utf8",
    );
    expect(productCardCode).toContain('import { Badge } from "@/components/ui/Badge"');
    expect(productCardCode).toContain('<Badge variant="primary" size="sm"');
    expect(productCardCode).toContain('<Badge variant="action" size="sm"');
  });
});
