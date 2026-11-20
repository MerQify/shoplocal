# Merqify Image Hub — phase 3: licensed search & discovery (build notes)

Branch `feature/1697-licensed-image-discovery`. Built for #1697 (part of #1669).

## What changed and why

- **`lib/image-discovery/`:**
  - `types.ts`: Defines `DiscoveredImage`, `DiscoveryProvider` (`"OPENVERSE" | "WIKIMEDIA" | "OPEN_FOOD_FACTS"`), `DiscoveryLicence`, `DiscoverySearchParams`, `DiscoverySearchResult`.
  - `openverse.ts`: Searches Openverse API with commercial license filter, maps CC0/PDM/BY/BY-SA, normalizes creator/attribution.
  - `wikimedia.ts`: Searches Wikimedia Commons MediaWiki API (`generator=search`), filters to image extensions only (`.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`), parses `extmetadata` (`Artist`, `LicenseShortName`), sanitizes HTML, maps open licences.
  - `open-food-facts.ts`: Searches Open Food Facts product database for package/front photography, maps `CC_BY_SA` and "Open Food Facts contributors" attribution.
  - `service.ts`: Aggregator querying selected/all providers in parallel using `Promise.allSettled`, with error resilience when one provider fails.
  - `*.test.ts`: Comprehensive unit tests covering parsing, licensing mapping, HTML sanitization, and parallel aggregation (7 tests).

- **`lib/image-hub-service.ts` & `features/admin/image-library.ts`:**
  - Added `searchDiscoveredImagesForStaff` and `importDiscoveredImageToHub` enforcing `STAFF` and `ADMIN` vendor roles.
  - `importDiscoveredImageToHub` fetches image bytes, validates content-type/size, and invokes `importAsset` on the Image Hub with full provenance, setting `status: "PENDING_REVIEW"`.
  - Added unit test cases in `lib/image-hub-service.test.ts`.

- **`/staff/image-library` UI:**
  - Created `components/staff/ImageDiscoveryPanel.tsx`: Collapsible search section with repository selector (`All`, `Openverse`, `Wikimedia Commons`, `Open Food Facts`), interactive preview cards with provider/licence badges and source link, and "Import to Library" action.
  - Wired into `components/staff/ImageLibraryClient.tsx` to automatically prepend newly imported assets into the active library view.

- **Batch Discovery CLI (`scripts/discover-product-images.ts`):**
  - CLI script with `--env-file`, `--vendor`, `--provider`, `--limit`, `--apply`, `--dry-run`.
  - Scans active products without real photos, queries discovery providers, and in `--apply` mode imports candidates into the hub as `PENDING_REVIEW`.
  - Verified with live dry run against staging database.

## Decisions taken during the build

- **Media filtering on Wikimedia Commons:** Wikimedia Commons namespace 6 includes non-image media (e.g. PDFs, DjVu catalogs, audio). A regex filter was added to accept only image extensions (`.jpe?g`, `.png`, `.webp`, `.svg`).
- **Resilient aggregation:** If one provider API fails or times out, the other providers' results are still returned, and errors are captured in the response `errors` map.

## Deviations from the spec

- None.

## Known-shaky areas

- None. All providers and service actions have unit tests with mock fixtures and live verification.
