# Merqify Image Hub — phase 3: licensed search & discovery (requirements)

Built for #1697 (part of #1669).

## Functional Requirements

### Discovery Providers & Aggregator (`lib/image-discovery/`)

- **R1:** The system must define a normalized `DiscoveredImage` model containing:
  - `id`: unique provider-scoped ID
  - `provider`: `"OPENVERSE" | "WIKIMEDIA" | "OPEN_FOOD_FACTS"`
  - `title`: string
  - `thumbnailUrl`: string
  - `originalUrl`: string
  - `sourceSite`: string
  - `licence`: `"CC0" | "PUBLIC_DOMAIN" | "CC_BY" | "CC_BY_SA"`
  - `attribution`: string
  - `width`?: number
  - `height`?: number
- **R2:** The **Openverse** provider must query the Openverse API (`https://api.openverse.org/v1/images/`), filtering by commercial licenses (`license_type=commercial` or open licenses `cc0,pdm,by,by-sa`), and map creator/attribution correctly.
- **R3:** The **Wikimedia Commons** provider must query the MediaWiki API on `commons.wikimedia.org`, extract image URLs and metadata (`Artist`, `LicenseShortName`), and reject files that do not carry open licences.
- **R4:** The **Open Food Facts** provider must query Open Food Facts for matching food products, extract package/product front images, assign `CC_BY_SA` licence, and attribute `"Open Food Facts contributors"`.
- **R5:** The discovery aggregator must support querying individual providers or all providers in parallel, gracefully handling provider timeouts or errors without failing the overall query.

### Server Actions (`features/admin/image-library.ts` / `lib/image-hub-service.ts`)

- **R6:** `searchDiscoveredImagesAction(params)` must require `STAFF` or `ADMIN` vendor role and return paginated or capped `DiscoveredImage[]`.
- **R7:** `importDiscoveredImageAction(image)` must require `STAFF` or `ADMIN` vendor role.
- **R8:** `importDiscoveredImageAction` must fetch the image bytes server-side, validate that the MIME type is an image (`image/jpeg`, `image/png`, `image/webp`), and invoke `importAsset` on the Image Hub with:
  - `source`: matching the provider (`OPENVERSE`, `WIKIMEDIA`, `OPEN_FOOD_FACTS`)
  - `licence`: matching the discovered licence
  - `attribution`: formatted attribution string
  - `originalUrl`: URL to the source image
  - `sourceSite`: name of source website
  - `rightsConfirmed`: `true`
  - `status`: `"PENDING_REVIEW"`
- **R9:** If the image is a duplicate on the Hub (matching SHA-256), `importDiscoveredImageAction` must handle the 200 response (`duplicate: true`) gracefully and return the existing asset.

### UI Integration (`/staff/image-library`)

- **R10:** `/staff/image-library` must feature a tab or section to search open licensed image repositories.
- **R11:** Discovered search results must display thumbnail, title, provider badge, licence badge, attribution, and a link to the original landing URL.
- **R12:** Clicking "Import to Library" must initiate the import, show a loading indicator, and upon success, notify the user and prepend the newly created `PENDING_REVIEW` asset into the active library view.

### Batch Discovery CLI (`scripts/discover-product-images.ts`)

- **R13:** A CLI script `scripts/discover-product-images.ts` must accept `--env-file`, `--vendor <slug>`, `--limit <n>`, `--provider <name>`, `--dry-run`, `--apply`.
- **R14:** The script must identify products missing photos, query the discovery providers, display candidates with licence and attribution, and in `--apply` mode, import candidates into the Hub as `PENDING_REVIEW`.

### Quality & SDD Discipline

- **R15:** `CHANGELOG.md` must record the changes on the branch before merge (Gate 4).
- **R16:** All quality checks (`npm run lint`, `npm run typecheck`, `npm run format:check`, `npx vitest run --maxWorkers=4`) and KMS checks (`kms:validate`, `kms:check-generated`) must exit 0.
