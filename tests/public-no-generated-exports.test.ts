import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * #1714 R9 — anything under `public/` is a Cloudflare static asset, served before the Worker runs,
 * so no sign-in check ever applies to it. Generated catalogue exports (which carry inactive products
 * and, in the master workbook, discount codes) were committed there and downloadable by anyone. They
 * are built live behind the platform-admin check now; this keeps them from coming back.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("public/ holds no generated export (#1714)", () => {
  it("has no file with -export. in its name", () => {
    const offenders = walk("public")
      .map((f) => relative(".", f).replace(/\\/g, "/"))
      .filter((f) => /-export\./i.test(f));
    expect(offenders).toEqual([]);
  });

  it("keeps public/templates/ to blank import templates only", () => {
    const offenders = readdirSync(join("public", "templates")).filter(
      (f) => !/-template\.(csv|xlsx)$/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});
