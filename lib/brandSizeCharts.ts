export type BrandSizeChartCategoryKey = "outerwear" | "pants" | "shoes" | "jewelry";
export type BrandSizeAudienceKey = "all" | "men" | "women";
export type BrandSizeMode = "letters" | "numbers" | "mixed";

export type BrandSizeChartAudience = {
  key: BrandSizeAudienceKey;
  label: string;
  sizeMode: BrandSizeMode;
  columns: string[];
  rows: string[][];
};

export type BrandSizeChartCategory = {
  key: BrandSizeChartCategoryKey;
  label: string;
  sizeMode: BrandSizeMode;
  columns: string[];
  rows: string[][];
  audiences: BrandSizeChartAudience[];
};

export type BrandSizeChart = {
  version: 1;
  categories: BrandSizeChartCategory[];
};

export const BRAND_SIZE_CHART_CATEGORIES: Array<{
  key: BrandSizeChartCategoryKey;
  label: string;
  defaultMode: BrandSizeMode;
}> = [
  { key: "outerwear", label: "Верхняя одежда", defaultMode: "letters" },
  { key: "pants", label: "Штаны", defaultMode: "mixed" },
  { key: "shoes", label: "Обувь", defaultMode: "numbers" },
  { key: "jewelry", label: "Ювелирные изделия", defaultMode: "mixed" },
];

export const BRAND_SIZE_AUDIENCES: Array<{
  key: BrandSizeAudienceKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "all", label: "Общая линейка", shortLabel: "Общая" },
  { key: "men", label: "Мужская линейка", shortLabel: "Мужская" },
  { key: "women", label: "Женская линейка", shortLabel: "Женская" },
];

const DEFAULT_COLUMNS: Record<BrandSizeChartCategoryKey, string[]> = {
  outerwear: ["Размер", "EU", "US", "UK", "Грудь, см", "Длина, см"],
  pants: ["Размер", "EU", "US", "UK", "Талия, см", "Бёдра, см"],
  shoes: ["Размер", "EU", "US", "UK", "JP/CM"],
  jewelry: ["Размер", "EU", "US", "Диаметр/обхват, см"],
};

export function createEmptyBrandSizeChart(): BrandSizeChart {
  return {
    version: 1,
    categories: BRAND_SIZE_CHART_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      sizeMode: category.defaultMode,
      columns: DEFAULT_COLUMNS[category.key],
      rows: [],
      audiences: BRAND_SIZE_AUDIENCES.map((audience) => ({
        key: audience.key,
        label: audience.label,
        sizeMode: category.defaultMode,
        columns: DEFAULT_COLUMNS[category.key],
        rows: [],
      })),
    })),
  };
}

function normalizeCell(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeAudience(input: any, fallback: BrandSizeChartCategory, audienceKey: BrandSizeAudienceKey): BrandSizeChartAudience {
  const meta = BRAND_SIZE_AUDIENCES.find((item) => item.key === audienceKey) ?? BRAND_SIZE_AUDIENCES[0];
  const columns: string[] = Array.isArray(input?.columns)
    ? input.columns.map(normalizeCell).filter(Boolean)
    : fallback.columns;
  const safeColumns = columns.length ? columns : fallback.columns;

  const rows = Array.isArray(input?.rows)
    ? input.rows
        .filter((row: any) => Array.isArray(row))
        .map((row: any[]) =>
          safeColumns.map((_column: string, index: number) => normalizeCell(row[index]))
        )
    : [];

  const sizeMode = input?.sizeMode === "letters" || input?.sizeMode === "numbers" || input?.sizeMode === "mixed"
    ? input.sizeMode
    : fallback.sizeMode;

  return {
    key: audienceKey,
    label: meta.label,
    sizeMode,
    columns: safeColumns,
    rows,
  };
}

function normalizeCategory(input: any, fallback: BrandSizeChartCategory): BrandSizeChartCategory {
  const columns: string[] = Array.isArray(input?.columns)
    ? input.columns.map(normalizeCell).filter(Boolean)
    : fallback.columns;
  const safeColumns = columns.length ? columns : fallback.columns;

  const rows = Array.isArray(input?.rows)
    ? input.rows
        .filter((row: any) => Array.isArray(row))
        .map((row: any[]) =>
          safeColumns.map((_column: string, index: number) => normalizeCell(row[index]))
        )
    : [];

  const sizeMode = input?.sizeMode === "letters" || input?.sizeMode === "numbers" || input?.sizeMode === "mixed"
    ? input.sizeMode
    : fallback.sizeMode;

  const legacyAllInput = { sizeMode, columns: safeColumns, rows };
  const audiences = BRAND_SIZE_AUDIENCES.map((audience) => {
    const match = Array.isArray(input?.audiences)
      ? input.audiences.find((item: any) => item?.key === audience.key)
      : null;
    return normalizeAudience(match ?? (audience.key === "all" ? legacyAllInput : null), fallback, audience.key);
  });
  const allAudience = audiences.find((audience) => audience.key === "all") ?? audiences[0];

  return {
    key: fallback.key,
    label: fallback.label,
    sizeMode: allAudience.sizeMode,
    columns: allAudience.columns,
    rows: allAudience.rows,
    audiences,
  };
}

function parseLegacyTable(text: string): BrandSizeChart | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || !lines.some((line) => line.includes("|"))) {
    return null;
  }

  const split = (line: string) =>
    line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, arr) => cell || (index > 0 && index < arr.length - 1));

  const headers = split(lines[0]);
  const rows = lines
    .slice(1)
    .map(split)
    .filter((row) => row.some(Boolean));

  if (!headers.length || !rows.length) return null;

  const chart = createEmptyBrandSizeChart();
  chart.categories[0] = {
    ...chart.categories[0],
    columns: headers,
    rows,
    audiences: chart.categories[0].audiences.map((audience) =>
      audience.key === "all"
        ? { ...audience, columns: headers, rows }
        : audience
    ),
  };
  return chart;
}

export function parseBrandSizeChart(value: unknown): BrandSizeChart {
  const empty = createEmptyBrandSizeChart();
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return empty;

  try {
    const raw = JSON.parse(text);
    if (raw?.version === 1 && Array.isArray(raw?.categories)) {
      return {
        version: 1,
        categories: empty.categories.map((fallback) => {
          const match = raw.categories.find((category: any) => category?.key === fallback.key);
          return normalizeCategory(match, fallback);
        }),
      };
    }
  } catch {
    // Legacy plain text format is handled below.
  }

  return parseLegacyTable(text) ?? empty;
}

export function serializeBrandSizeChart(chart: BrandSizeChart): string {
  const empty = createEmptyBrandSizeChart();
  const normalized: BrandSizeChart = {
    version: 1,
    categories: empty.categories.map((fallback) => {
      const match = chart.categories.find((category) => category.key === fallback.key);
      return normalizeCategory(match, fallback);
    }),
  };

  const hasContent = normalized.categories.some((category) => {
    const fallback = empty.categories.find((item) => item.key === category.key);
    const columnsChanged = JSON.stringify(category.columns) !== JSON.stringify(fallback?.columns ?? []);
    const modeChanged = category.sizeMode !== fallback?.sizeMode;
    const audienceChanged = category.audiences.some((audience) => {
      const fallbackAudience = fallback?.audiences.find((item) => item.key === audience.key);
      return (
        JSON.stringify(audience.columns) !== JSON.stringify(fallbackAudience?.columns ?? []) ||
        audience.sizeMode !== fallbackAudience?.sizeMode ||
        audience.rows.length > 0
      );
    });
    return columnsChanged || modeChanged || category.rows.length > 0 || audienceChanged;
  });

  return hasContent ? JSON.stringify(normalized) : "";
}

export function getBrandSizeChartCategory(
  chart: BrandSizeChart,
  key: BrandSizeChartCategoryKey | null | undefined
) {
  if (!key) return null;
  return chart.categories.find((category) => category.key === key) ?? null;
}

export function getBrandSizeChartAudience(
  category: BrandSizeChartCategory | null | undefined,
  audience: BrandSizeAudienceKey | null | undefined
) {
  if (!category) return null;
  const selected = category.audiences.find((item) => item.key === (audience ?? "all"));
  const common = category.audiences.find((item) => item.key === "all");
  if (selected?.rows.length) return selected;
  if (common?.rows.length) return common;
  return selected ?? common ?? null;
}

export function inferBrandSizeCategory(input: {
  categoryName?: string | null;
  categorySlug?: string | null;
  subcategory?: string | null;
  sizeType?: string | null;
}): BrandSizeChartCategoryKey | null {
  const haystack = [
    input.categoryName,
    input.categorySlug,
    input.subcategory,
    input.sizeType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(shoe|shoes|footwear|sneaker|sneakers|boot|boots|loafers|sandals|обув|кроссов|ботин)/.test(haystack)) {
    return "shoes";
  }
  if (/(jewelry|jewel|ring|rings|bracelet|necklace|earring|watch|ювел|кольц|брасл|серьг|цепоч|часы)/.test(haystack)) {
    return "jewelry";
  }
  if (/(pants|jeans|trousers|shorts|skirts|bottom|брюк|джинс|штан|шорт|юбк)/.test(haystack)) {
    return "pants";
  }
  if (/(outerwear|jacket|jackets|coat|coats|parka|vest|hoodie|sweater|shirt|top|clothes|верх|куртк|пальт|парка|жилет|худи|свитер|рубаш|футбол|одеж)/.test(haystack)) {
    return "outerwear";
  }

  return null;
}

export function getPrimarySizeLabels(category: Pick<BrandSizeChartCategory, "rows"> | Pick<BrandSizeChartAudience, "rows"> | null | undefined): string[] {
  if (!category) return [];
  return Array.from(
    new Set(
      category.rows
        .map((row) => normalizeCell(row[0]))
        .filter(Boolean)
    )
  );
}
