import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * #1705 R1-R5, R12: the nightly Image Hub sync workflow, checked as text (no
 * YAML parser is a declared dependency; same approach as
 * tests/pricing-review-workflow.test.ts).
 */

const WORKFLOW = readFileSync(".github/workflows/image-hub-sync.yml", "utf8");
const HELPER = readFileSync("scripts/write-hub-sync-env.sh", "utf8");

describe("image-hub-sync.yml triggers (R1)", () => {
  it("runs nightly at 02:17 UTC and nowhere else on a schedule", () => {
    expect(WORKFLOW.match(/- cron:/g)).toHaveLength(1);
    expect(WORKFLOW).toContain('- cron: "17 2 * * *"');
  });

  it("offers cell, limit and dry_run on manual dispatch", () => {
    expect(WORKFLOW).toContain("workflow_dispatch:");
    expect(WORKFLOW).toMatch(
      /cell:\s*\n\s*description:[^\n]*\n\s*type: choice\s*\n\s*options: \[all, afc, merqify\]\s*\n\s*default: all/,
    );
    expect(WORKFLOW).toMatch(
      /limit:\s*\n\s*description:[^\n]*\n\s*type: string\s*\n\s*required: false\s*\n\s*default: ""/,
    );
    expect(WORKFLOW).toMatch(
      /dry_run:\s*\n\s*description:[^\n]*\n\s*type: boolean\s*\n\s*default: false/,
    );
  });
});

describe("image-hub-sync.yml job (R2, R4)", () => {
  it("uses the production environment and lets each cell fail alone", () => {
    expect(WORKFLOW).toContain("environment: production");
    expect(WORKFLOW).toContain("fail-fast: false");
    expect(WORKFLOW).toContain("group: image-hub-sync-${{ matrix.cell }}");
    expect(WORKFLOW).toContain("cancel-in-progress: false");
  });

  it("reads every AFC secret by its own name", () => {
    for (const name of [
      "AFC_DIRECT_URL",
      "AFC_S3_ENDPOINT",
      "AFC_S3_BUCKET",
      "AFC_S3_ACCESS_KEY",
      "AFC_S3_SECRET_KEY",
      "AFC_S3_REGION",
      "IMAGE_HUB_URL",
      "AFC_IMAGE_HUB_API_KEY",
    ]) {
      expect(WORKFLOW).toContain(`secrets.${name} }}`);
    }
  });

  it("never falls back from an AFC secret to a Merqify one", () => {
    expect(WORKFLOW).not.toMatch(/secrets\.AFC_[A-Z_]+\s*\|\|/);
  });

  it("removes the env file even when the run fails", () => {
    expect(WORKFLOW).toMatch(
      /if: always\(\)\s*\n\s*run: rm -f "\$RUNNER_TEMP\/\$\{\{ matrix\.cell \}\}\.vars"/,
    );
  });
});

describe("no secret reaches the log (R5)", () => {
  it("has no shell tracing and never echoes a secret expression", () => {
    for (const text of [WORKFLOW, HELPER]) {
      expect(text).not.toMatch(/set -x/);
      expect(text).not.toMatch(/(echo|printf)[^\n]*\$\{\{\s*secrets\./);
    }
  });

  it("writes the file with owner-only permissions and quoted values", () => {
    expect(HELPER).toContain("umask 077");
    expect(HELPER).toContain(`printf '%s="%s"\\n'`);
  });
});
