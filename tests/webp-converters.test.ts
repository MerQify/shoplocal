import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Proves #1675 - browser WebP conversion is consolidated onto `lib/webp-convert.ts`.
 *
 * Canvas-based image downscaling and WebP conversion must go through `convertToWebp` in
 * `lib/webp-convert.ts`. This ensures consistent EXIF orientation handling, standard quality,
 * and edge bounds across the store.
 *
 * `components/staff/VendorMarkUploader.tsx` is the sole documented exception because it renders
 * five distinct PNG mark assets (`MARK_FILES`) with square containment and background filling via
 * `MARK_CONTENT_TYPE` (`image/png`), rather than converting an arbitrary image to WebP.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRECTORIES = ["app", "components", "features", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".open-next", ".wrangler"]);

const ALLOWED_TO_BLOB = new Set([
  join("lib", "webp-convert.ts"),
  join("components", "staff", "VendorMarkUploader.tsx"),
]);

const ALLOWED_CREATE_IMAGE_BITMAP = new Set([
  join("lib", "webp-convert.ts"),
  join("components", "staff", "VendorMarkUploader.tsx"),
]);

interface Violation {
  file: string;
  type: "toBlob" | "createImageBitmap";
  line: number;
}

function findViolations(fileName: string, text: string): Violation[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      // Check for canvas.toBlob(...) or any .toBlob(...) call
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === "toBlob") {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        violations.push({ file: fileName, type: "toBlob", line: line + 1 });
      }

      // Check for createImageBitmap(...)
      if (ts.isIdentifier(expr) && expr.text === "createImageBitmap") {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        violations.push({ file: fileName, type: "createImageBitmap", line: line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return violations;
}

function collectFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      // Exclude generated staff runbook docs bundle if present
      if (full.includes(`runbook${sep}docs.ts`)) continue;
      out.push(full);
    }
  }
}

describe("WebP converter consolidation (#1675)", () => {
  const files: string[] = [];
  for (const dir of SCAN_DIRECTORIES) {
    const full = join(ROOT, dir);
    collectFiles(full, files);
  }

  it("restricts canvas.toBlob to lib/webp-convert.ts and VendorMarkUploader", () => {
    const illegalBlobCalls: Violation[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWED_TO_BLOB.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      const violations = findViolations(rel, content).filter((v) => v.type === "toBlob");
      illegalBlobCalls.push(...violations);
    }

    expect(
      illegalBlobCalls,
      `Found disallowed canvas.toBlob() calls outside lib/webp-convert.ts: ${JSON.stringify(illegalBlobCalls, null, 2)}`,
    ).toEqual([]);
  }, 30_000);

  it("restricts createImageBitmap to lib/webp-convert.ts and VendorMarkUploader", () => {
    const illegalBitmapCalls: Violation[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWED_CREATE_IMAGE_BITMAP.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      const violations = findViolations(rel, content).filter((v) => v.type === "createImageBitmap");
      illegalBitmapCalls.push(...violations);
    }

    expect(
      illegalBitmapCalls,
      `Found disallowed createImageBitmap() calls outside lib/webp-convert.ts: ${JSON.stringify(illegalBitmapCalls, null, 2)}`,
    ).toEqual([]);
  }, 30_000);
});
