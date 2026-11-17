import {
  detectTemplateType,
  normalizeHeader,
  parseBoolean,
  parseInteger,
  parseMoneyToPence,
  NET_CONTENT_UNITS,
  STOCK_MODES,
  type ParsedProductRow,
  type RowValidationError,
} from "./schema";

export interface ExistingProductLookup {
  id: string;
  name: string;
  slug: string;
  plu: string | null;
  barcode: string | null;
  basePrice: number;
  unitLabel: string;
  isActive: boolean;
  manuallyEditedFields?: string[];
}

export interface PlannedTemplateLine {
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "INVALID";
  autoReady: boolean;
  reason: string;
  matchedProductId?: string;
  matchedProductName?: string;
  row: ParsedProductRow;
  validationErrors: RowValidationError[];
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface TemplateImportAnalysis {
  templateType: "universal" | "essential" | "unknown";
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  createCount: number;
  updateCount: number;
  plannedLines: PlannedTemplateLine[];
  errors: RowValidationError[];
}

/**
 * Validates a 2D string grid from an uploaded spreadsheet or CSV.
 */
export function analyzeTemplateGrid(
  grid: string[][],
  existingProducts: ExistingProductLookup[] = [],
): TemplateImportAnalysis {
  if (!grid || grid.length < 2) {
    return {
      templateType: "unknown",
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      createCount: 0,
      updateCount: 0,
      plannedLines: [],
      errors: [{ rowNumber: 1, field: "File", message: "File contains no data rows." }],
    };
  }

  const rawHeaders = grid[0];
  const templateType = detectTemplateType(rawHeaders);

  if (templateType === "unknown") {
    return {
      templateType: "unknown",
      totalRows: grid.length - 1,
      validRowsCount: 0,
      invalidRowsCount: grid.length - 1,
      createCount: 0,
      updateCount: 0,
      plannedLines: [],
      errors: [
        {
          rowNumber: 1,
          field: "Headers",
          message:
            "Headers do not match the Universal or Essential product template. Required columns: Product Name, Brand, Category, Price, Unit/Pack Size.",
        },
      ],
    };
  }

  // Build header column index map
  const headerColIndex: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerColIndex[normalizeHeader(h)] = idx;
  });

  const getCell = (row: string[], ...aliases: string[]): string => {
    for (const a of aliases) {
      const idx = headerColIndex[normalizeHeader(a)];
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return "";
  };

  // Build fast lookups for existing products
  const productById = new Map<string, ExistingProductLookup>();
  const productByBarcode = new Map<string, ExistingProductLookup>();
  const productByPlu = new Map<string, ExistingProductLookup>();
  const productByName = new Map<string, ExistingProductLookup>();

  for (const ep of existingProducts) {
    productById.set(ep.id, ep);
    if (ep.barcode) productByBarcode.set(ep.barcode.trim(), ep);
    if (ep.plu) productByPlu.set(ep.plu.trim(), ep);
    productByName.set(ep.name.trim().toLowerCase(), ep);
  }

  const plannedLines: PlannedTemplateLine[] = [];
  const allErrors: RowValidationError[] = [];

  let createCount = 0;
  let updateCount = 0;

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const rowNumber = r + 1; // 1-based row number matching spreadsheet UI

    // Skip entirely empty rows
    if (row.every((cell) => cell === undefined || cell.trim() === "")) {
      continue;
    }

    const rowErrors: RowValidationError[] = [];

    const productId = getCell(row, "productid", "id");
    const name = getCell(row, "productname", "name");
    const brand = getCell(row, "brand");
    const category = getCell(row, "category");
    const priceRaw = getCell(row, "price", "baseprice");
    const unitLabel = getCell(row, "unitpacksize", "unitsize", "size", "unitlabel");
    const barcodeRaw = getCell(row, "barcode");
    const pluRaw = getCell(row, "plu");
    const stockModeRaw = getCell(row, "stockmode");
    const currentStockRaw = getCell(row, "currentstock", "stock", "quantity");
    const isActiveRaw = getCell(row, "isactive");

    // Mandatory Field Validations
    if (!name) {
      rowErrors.push({ rowNumber, field: "Product Name*", message: "Product Name is required." });
    }

    if (!brand) {
      rowErrors.push({ rowNumber, field: "Brand*", message: "Brand is required." });
    }

    if (!category) {
      rowErrors.push({ rowNumber, field: "Category*", message: "Category is required." });
    }

    const pricePence = parseMoneyToPence(priceRaw);
    if (pricePence === null) {
      rowErrors.push({
        rowNumber,
        field: "Price (£)*",
        message: `Invalid or missing price "${priceRaw}". Must be a valid positive amount (e.g. 2.49).`,
      });
    }

    if (!unitLabel) {
      rowErrors.push({
        rowNumber,
        field: "Unit/Pack Size*",
        message: "Unit/Pack Size is required (e.g. 1kg, 500g, Each).",
      });
    }

    // Optional Fields & Normalization
    let stockMode: (typeof STOCK_MODES)[number] = "UNKNOWN";
    if (stockModeRaw) {
      const upper = stockModeRaw.toUpperCase();
      if ((STOCK_MODES as readonly string[]).includes(upper)) {
        stockMode = upper as (typeof STOCK_MODES)[number];
      } else {
        rowErrors.push({
          rowNumber,
          field: "Stock Mode*",
          message: `Invalid stock mode "${stockModeRaw}". Allowed: ${STOCK_MODES.join(", ")}.`,
        });
      }
    }

    const currentStock = currentStockRaw !== "" ? parseInteger(currentStockRaw) : null;
    if (currentStockRaw !== "" && currentStock === null) {
      rowErrors.push({
        rowNumber,
        field: "Current Stock",
        message: `Current Stock "${currentStockRaw}" must be a whole number.`,
      });
    }

    const isActive = isActiveRaw !== "" ? parseBoolean(isActiveRaw, true) : true;

    // Universal Specific Fields
    const compareAtRaw = getCell(row, "compareatprice", "originalprice");
    const originalPricePence = compareAtRaw ? parseMoneyToPence(compareAtRaw) : null;

    const netAmountRaw = getCell(row, "netcontentamount");
    const netContentAmount = netAmountRaw !== "" ? parseInteger(netAmountRaw) : null;

    const netUnitRaw = getCell(row, "netcontentunit").toUpperCase();
    let netContentUnit: (typeof NET_CONTENT_UNITS)[number] | null = null;
    if (netUnitRaw) {
      if ((NET_CONTENT_UNITS as readonly string[]).includes(netUnitRaw)) {
        netContentUnit = netUnitRaw as (typeof NET_CONTENT_UNITS)[number];
      } else {
        rowErrors.push({
          rowNumber,
          field: "Net Content Unit",
          message: `Invalid net content unit "${netUnitRaw}". Allowed: ${NET_CONTENT_UNITS.join(", ")}.`,
        });
      }
    }

    const lowStockRaw = getCell(row, "lowstockthreshold");
    const lowStockThreshold = lowStockRaw !== "" ? parseInteger(lowStockRaw) : null;

    const isHalal = parseBoolean(getCell(row, "ishalal"), false);
    const isVegetarian = parseBoolean(getCell(row, "isvegetarian"), false);
    const isFresh = parseBoolean(getCell(row, "isfresh"), false);
    const isOrganic = parseBoolean(getCell(row, "isorganic"), false);
    const isGlutenFree = parseBoolean(getCell(row, "isglutenfree"), false);
    const isHmcCertified = parseBoolean(getCell(row, "ishmccertified"), false);
    const hmcReference = getCell(row, "hmcreference") || null;

    const hmcDateRaw = getCell(row, "hmcverifiedat");
    let hmcVerifiedAt: Date | null = null;
    if (hmcDateRaw) {
      const d = new Date(hmcDateRaw);
      if (isNaN(d.getTime())) {
        rowErrors.push({
          rowNumber,
          field: "HMC Verified At",
          message: `Invalid date "${hmcDateRaw}". Expected format: YYYY-MM-DD.`,
        });
      } else {
        hmcVerifiedAt = d;
      }
    }

    // Speciality attributes
    const attributes: Record<string, string> = {};
    const storage = getCell(row, "attrstorage", "storage");
    if (storage) attributes["storage"] = storage;
    const cut = getCell(row, "attrcut", "cut");
    if (cut) attributes["cut"] = cut;
    const variety = getCell(row, "attrvarietygrainspecies", "variety", "grain", "species");
    if (variety) attributes["variety"] = variety;
    const form = getCell(row, "attrform", "form");
    if (form) attributes["form"] = form;

    const offerQtyRaw = getCell(row, "offergroupqty");
    const offerGroupQuantity = offerQtyRaw !== "" ? parseInteger(offerQtyRaw) : null;
    const offerPriceRaw = getCell(row, "offergroupprice");
    const offerGroupPricePence = offerPriceRaw !== "" ? parseMoneyToPence(offerPriceRaw) : null;

    const parsedRow: ParsedProductRow = {
      rowNumber,
      productId: productId || undefined,
      name,
      brand,
      category,
      department: getCell(row, "department") || undefined,
      pricePence: pricePence ?? 0,
      originalPricePence,
      costPricePence: parseMoneyToPence(getCell(row, "costprice")),
      vatRatePercent: parseInteger(getCell(row, "vatrate")),
      unitLabel,
      netContentAmount,
      netContentUnit,
      barcode: barcodeRaw || null,
      plu: pluRaw || null,
      stockMode,
      currentStock,
      lowStockThreshold,
      isHalal,
      isVegetarian,
      isFresh,
      isOrganic,
      isGlutenFree,
      isHmcCertified,
      hmcReference,
      hmcVerifiedAt,
      ageRestriction: getCell(row, "agerestriction") || null,
      countryOfOrigin: getCell(row, "countryoforigin") || null,
      attributes,
      offerGroupQuantity,
      offerGroupPricePence,
      shortDescription: getCell(row, "shortdescription") || null,
      description: getCell(row, "descriptionnotes", "description") || null,
      ingredients: getCell(row, "ingredients") || null,
      allergenInfo: getCell(row, "allergeninfo") || null,
      slug: getCell(row, "urlslug", "slug") || null,
      isActive,
      isFeatured: parseBoolean(getCell(row, "isfeatured"), false),
    };

    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors);
      plannedLines.push({
        rowNumber,
        action: "INVALID",
        autoReady: false,
        reason: rowErrors.map((e) => e.message).join(" | "),
        row: parsedRow,
        validationErrors: rowErrors,
      });
      continue;
    }

    // Matching logic:
    // 1. By Product ID (highest authority)
    // 2. By Barcode
    // 3. By PLU
    // 4. By exact Name
    let matchedProduct: ExistingProductLookup | undefined;
    let matchReason = "";

    if (productId && productById.has(productId)) {
      matchedProduct = productById.get(productId);
      matchReason = "Matched by Product ID";
    } else if (barcodeRaw && productByBarcode.has(barcodeRaw)) {
      matchedProduct = productByBarcode.get(barcodeRaw);
      matchReason = `Matched by Barcode (${barcodeRaw})`;
    } else if (pluRaw && productByPlu.has(pluRaw)) {
      matchedProduct = productByPlu.get(pluRaw);
      matchReason = `Matched by PLU (${pluRaw})`;
    } else if (productByName.has(name.toLowerCase())) {
      matchedProduct = productByName.get(name.toLowerCase());
      matchReason = "Matched by exact product name";
    }

    if (matchedProduct) {
      updateCount++;
      const changes: { field: string; oldValue: any; newValue: any }[] = [];

      if (matchedProduct.basePrice !== parsedRow.pricePence) {
        changes.push({
          field: "basePrice",
          oldValue: matchedProduct.basePrice,
          newValue: parsedRow.pricePence,
        });
      }
      if (matchedProduct.unitLabel !== parsedRow.unitLabel) {
        changes.push({
          field: "unitLabel",
          oldValue: matchedProduct.unitLabel,
          newValue: parsedRow.unitLabel,
        });
      }

      plannedLines.push({
        rowNumber,
        action: "UPDATE",
        autoReady: true, // Zero-decision ready
        reason: matchReason,
        matchedProductId: matchedProduct.id,
        matchedProductName: matchedProduct.name,
        row: parsedRow,
        validationErrors: [],
        changes,
      });
    } else {
      createCount++;
      plannedLines.push({
        rowNumber,
        action: "CREATE",
        autoReady: true, // Zero-decision ready
        reason: "New product to create",
        row: parsedRow,
        validationErrors: [],
      });
    }
  }

  const validRowsCount = plannedLines.filter((l) => l.action !== "INVALID").length;
  const invalidRowsCount = plannedLines.filter((l) => l.action === "INVALID").length;

  return {
    templateType,
    totalRows: plannedLines.length,
    validRowsCount,
    invalidRowsCount,
    createCount,
    updateCount,
    plannedLines,
    errors: allErrors,
  };
}
