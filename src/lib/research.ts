// Prospecting search against the Miami-Dade "Property @ PaGis" layer.
// Free ArcGIS REST query — full tax-roll attributes + owner + point geometry.
//
// Layer: MD_LandInformation/MapServer/24 (point, maxRecordCount 1000),
// supports SQL where-clauses, pagination (resultOffset), and outSR.

const LAYER =
  "https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/24/query";

const SQFT_PER_ACRE = 43560;

// DOR use-code groups (Miami-Dade 4-digit codes; first digits map to FL DOR).
export const LAND_USE_GROUPS = {
  residential: { label: "Residential", lo: "0000", hi: "1000" },
  commercial: { label: "Commercial", lo: "1000", hi: "4000" },
  industrial: { label: "Industrial", lo: "4000", hi: "5000" },
  agricultural: { label: "Agricultural", lo: "5000", hi: "7000" },
  institutional: { label: "Institutional", lo: "7000", hi: "8000" },
  government: { label: "Government", lo: "8000", hi: "9000" },
} as const;

export type LandUseKey = keyof typeof LAND_USE_GROUPS;

export interface ResearchFilters {
  noStructures?: boolean;
  minAcres?: number;
  maxAcres?: number;
  landUse?: LandUseKey[];
  zones?: string[]; // PRIMARY_ZONE codes
  minValue?: number;
  maxValue?: number;
}

export interface ResearchResult {
  folio: string;
  owner: string;
  siteAddress: string;
  dorCode: string;
  dorDesc: string;
  zone: string;
  acres: number;
  buildingCount: number;
  landValue: number | null;
  totalValue: number | null;
  lat: number | null;
  lon: number | null;
}

export interface ResearchResponse {
  count: number;
  results: ResearchResult[];
  offset: number;
  hasMore: boolean;
  where: string;
}

const sqlNum = (n: number) => (Number.isFinite(n) ? String(Math.round(n)) : "");

/** Build the ArcGIS SQL where-clause from filters. Returns null if no filters. */
export function buildWhere(f: ResearchFilters): string | null {
  const clauses: string[] = [];

  if (f.noStructures) clauses.push("BUILDING_COUNT = 0");

  if (f.minAcres != null && f.minAcres > 0)
    clauses.push(`LOT_SIZE >= ${sqlNum(f.minAcres * SQFT_PER_ACRE)}`);
  if (f.maxAcres != null && f.maxAcres > 0)
    clauses.push(`LOT_SIZE <= ${sqlNum(f.maxAcres * SQFT_PER_ACRE)}`);

  if (f.landUse && f.landUse.length > 0) {
    const ors = f.landUse
      .filter((k) => k in LAND_USE_GROUPS)
      .map((k) => {
        const g = LAND_USE_GROUPS[k];
        return `(DOR_CODE_CUR >= '${g.lo}' AND DOR_CODE_CUR < '${g.hi}')`;
      });
    if (ors.length) clauses.push(`(${ors.join(" OR ")})`);
  }

  if (f.zones && f.zones.length > 0) {
    const list = f.zones
      .map((z) => z.trim().replace(/'/g, ""))
      .filter(Boolean)
      .map((z) => `'${z}'`);
    if (list.length) clauses.push(`PRIMARY_ZONE IN (${list.join(",")})`);
  }

  if (f.minValue != null && f.minValue > 0)
    clauses.push(`TOTAL_VAL_CUR >= ${sqlNum(f.minValue)}`);
  if (f.maxValue != null && f.maxValue > 0)
    clauses.push(`TOTAL_VAL_CUR <= ${sqlNum(f.maxValue)}`);

  return clauses.length ? clauses.join(" AND ") : null;
}

const OUT_FIELDS = [
  "FOLIO",
  "TRUE_OWNER1",
  "TRUE_SITE_ADDR",
  "TRUE_SITE_CITY",
  "TRUE_SITE_ZIP_CODE",
  "DOR_CODE_CUR",
  "DOR_DESC",
  "PRIMARY_ZONE",
  "LOT_SIZE",
  "BUILDING_COUNT",
  "LAND_VAL_CUR",
  "TOTAL_VAL_CUR",
].join(",");

interface PaGisAttrs {
  FOLIO?: string;
  TRUE_OWNER1?: string;
  TRUE_SITE_ADDR?: string;
  TRUE_SITE_CITY?: string;
  TRUE_SITE_ZIP_CODE?: string;
  DOR_CODE_CUR?: string;
  DOR_DESC?: string;
  PRIMARY_ZONE?: string;
  LOT_SIZE?: number;
  BUILDING_COUNT?: number;
  LAND_VAL_CUR?: number | null;
  TOTAL_VAL_CUR?: number | null;
}

async function getCount(where: string, signal?: AbortSignal): Promise<number> {
  const qs = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
  const res = await fetch(`${LAYER}?${qs}`, { signal, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`County count query failed (${res.status}).`);
  const data = (await res.json()) as { count?: number; error?: unknown };
  if (data.error) throw new Error("County count query rejected the filter.");
  return data.count ?? 0;
}

export async function runResearch(
  filters: ResearchFilters,
  offset = 0,
  limit = 250,
  signal?: AbortSignal,
): Promise<ResearchResponse> {
  const where = buildWhere(filters);
  if (!where) {
    return { count: 0, results: [], offset, hasMore: false, where: "" };
  }

  const count = await getCount(where, signal);

  const qs = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "LOT_SIZE DESC",
    resultOffset: String(offset),
    resultRecordCount: String(limit),
    f: "json",
  });
  const res = await fetch(`${LAYER}?${qs}`, { signal, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`County query failed (${res.status}).`);
  const data = (await res.json()) as {
    features?: { attributes: PaGisAttrs; geometry?: { x: number; y: number } }[];
    error?: unknown;
  };
  if (data.error) throw new Error("County query rejected the filter.");

  const results: ResearchResult[] = (data.features ?? []).map((feat) => {
    const a = feat.attributes;
    return {
      folio: a.FOLIO ?? "",
      owner: a.TRUE_OWNER1 ?? "",
      siteAddress: [a.TRUE_SITE_ADDR, a.TRUE_SITE_CITY, a.TRUE_SITE_ZIP_CODE]
        .filter(Boolean)
        .join(", "),
      dorCode: a.DOR_CODE_CUR ?? "",
      dorDesc: a.DOR_DESC ?? "",
      zone: a.PRIMARY_ZONE ?? "",
      acres: a.LOT_SIZE ? a.LOT_SIZE / SQFT_PER_ACRE : 0,
      buildingCount: a.BUILDING_COUNT ?? 0,
      landValue: a.LAND_VAL_CUR ?? null,
      totalValue: a.TOTAL_VAL_CUR ?? null,
      lat: feat.geometry?.y ?? null,
      lon: feat.geometry?.x ?? null,
    };
  });

  return {
    count,
    results,
    offset,
    hasMore: offset + results.length < count,
    where,
  };
}
