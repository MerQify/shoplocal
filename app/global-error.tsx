"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/errors/ErrorPanel";
import { reloadIfStaleDeployment } from "@/lib/stale-deployment";
import "./globals.css";

/**
 * The outermost boundary (#459). Catches a throw in `app/layout.tsx` itself, so
 * it REPLACES that layout and must supply its own `<html>`/`<body>` and its own
 * stylesheet import.
 *
 * KNOWN LIMIT, not an oversight (#478): this page carries no per-vendor
 * branding. `brandStyle()` runs in `StorefrontChrome` and `app/(admin)/
 * layout.tsx`, both of which are below the root layout that just failed, so
 * `--color-primary` and friends resolve to `tokens.css`'s `:root` defaults —
 * Aheed's palette, for every vendor. Nothing can be done about that here: the
 * element that would carry the vendor's custom properties is the one that
 * threw. The three lower boundaries do keep their vendor's branding.
 *
 * The font is likewise absent — `--font-poppins` is injected by `next/font` on
 * the root layout's `<html>`, so `--font-sans` falls back to its system stack.
 */
export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Re-fetches and re-renders the segment (Next 16.2+); `reset` only re-renders (#1666). */
  retry?: () => void;
}) {
  useEffect(() => {
    console.error("Caught by global error boundary:", error);
    // #1664 — a page left open across a deploy: reload once instead of showing the panel.
    reloadIfStaleDeployment(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorPanel
          title="Something went wrong"
          message="We hit a problem loading the store. Trying again may help; if it keeps happening, please contact support."
          onRetry={retry ?? reset}
        />
      </body>
    </html>
  );
}
