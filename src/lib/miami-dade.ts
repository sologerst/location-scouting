// Miami-Dade County Property Appraiser — live public lookup client.
//
// Backs onto the same public service proxy the official property search uses:
//   https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
//
// Owner name + mailing address are public record under Florida public-records law.
// This returns authoritative, county-sourced data (our "verified" tier).

import type {
  MailingAddress,
  OwnerLookupResult,
  OwnerMatch,
  OwnerName,
  OwnerRecord,
  QueryType,
} from "./types";

const PROXY =
  "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx";
const CLIENT_APP = "PropertySearch";
const SOURCE = "Miami-Dade County Property Appraiser";

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; LocationScouting/0.1; +https://thinkswell.com)",
  Accept: "application/json, text/plain, */*",
};

/** 13 digits only. Accepts "01-4137-023-0020" or "0141370230020". */
export function normalizeFolio(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 13 ? digits : null;
}

/** Format 13 digits as 99-9999-999-9999. */
export function formatFolio(raw: string): string {
  if (raw.length !== 13) return raw;
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`;
}

/** Auto-detect whether a query string is a folio or an address. */
export function detectQueryType(query: string): QueryType {
  return normalizeFolio(query) ? "folio" : "address";
}

const BUSINESS_HINTS =
  /\b(LLC|L\.?L\.?C|INC|CORP|CO|COMPANY|LP|LLP|LTD|TRUST|TR|ASSOC|PARTNERS|HOLDINGS|PROPERTIES|GROUP|FUND|BANK|ENTERPRISES?|VENTURES?|REALTY|INVESTMENTS?)\b/i;
const GOV_HINTS =
  /\b(COUNTY|CITY OF|STATE OF|DEPARTMENT|DEPT|AUTHORITY|DISTRICT|FEDERAL|MUNICIPAL|HOUSING)\b/i;

function classifyOwner(name: string): OwnerRecord["ownerKind"] {
  if (!name) return "unknown";
  if (GOV_HINTS.test(name)) return "government";
  if (BUSINESS_HINTS.test(name)) return "business";
  return "individual";
}

async function callProxy(
  operation: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({
    Operation: operation,
    clientAppName: CLIENT_APP,
    ...params,
  });
  const res = await fetch(`${PROXY}?${qs.toString()}`, {
    headers: COMMON_HEADERS,
    signal,
    // county data changes at most weekly; let the platform cache it
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Miami-Dade proxy ${operation} returned HTTP ${res.status}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// ---- response shapes (partial, only what we read) ----

interface MinInfo {
  Owner1?: string;
  Owner2?: string;
  Owner3?: string;
  SiteAddress?: string;
  SiteUnit?: string;
  Status?: string;
  Strap?: string;
  Municipality?: string;
}

interface DetailResponse {
  Completed?: boolean;
  OwnerInfos?: { Name?: string; PercentageOwn?: number }[];
  MailingAddress?: {
    Address1?: string;
    Address2?: string;
    City?: string;
    State?: string;
    ZipCode?: string;
  };
  SiteAddress?: { Address?: string }[];
  PropertyInfo?: {
    FolioNumber?: string;
    DORDescription?: string;
    Municipality?: string;
    NeighborhoodDescription?: string;
  };
  Assessment?: {
    AssessmentInfos?: {
      AssessedValue?: number;
      TotalValue?: number;
      Year?: number;
    }[];
  };
}

function toMailing(
  m: DetailResponse["MailingAddress"],
): MailingAddress | null {
  if (!m || !m.Address1) return null;
  return {
    line1: m.Address1 ?? "",
    line2: m.Address2 || undefined,
    city: m.City ?? "",
    state: m.State ?? "",
    zip: m.ZipCode ?? "",
  };
}

/** Fetch the full, normalized owner record for a 13-digit folio. */
export async function getOwnerByFolio(
  folioRaw: string,
  signal?: AbortSignal,
): Promise<OwnerRecord | null> {
  const data = (await callProxy(
    "GetPropertySearchByFolio",
    { folioNumber: folioRaw },
    signal,
  )) as DetailResponse;

  if (!data || data.Completed === false || !data.PropertyInfo) return null;

  const owners: OwnerName[] = (data.OwnerInfos ?? [])
    .map((o) => ({
      name: (o.Name ?? "").trim(),
      percentOwn: o.PercentageOwn ?? 0,
    }))
    .filter((o) => o.name.length > 0);

  if (owners.length === 0) return null;

  const assessment = data.Assessment?.AssessmentInfos?.[0];
  const folio = data.PropertyInfo.FolioNumber || formatFolio(folioRaw);

  return {
    folio,
    folioRaw,
    siteAddress: data.SiteAddress?.[0]?.Address ?? "",
    owners,
    mailingAddress: toMailing(data.MailingAddress),
    propertyType: data.PropertyInfo.DORDescription ?? null,
    municipality: data.PropertyInfo.Municipality ?? null,
    neighborhood: data.PropertyInfo.NeighborhoodDescription ?? null,
    assessedValue: assessment?.AssessedValue ?? null,
    totalValue: assessment?.TotalValue ?? null,
    rollYear: assessment?.Year ?? null,
    ownerKind: classifyOwner(owners[0].name),
  };
}

/** Search by free-text address. Returns the list of matching parcels. */
export async function searchByAddress(
  address: string,
  signal?: AbortSignal,
): Promise<OwnerMatch[]> {
  // NOTE: the official site uses Operation=GetAddress for free-text address
  // search (GetPropertySearchByAddress returns a default record and is wrong).
  const data = await callProxy(
    "GetAddress",
    { from: "1", to: "25", myAddress: address, myUnit: "" },
    signal,
  );
  const list = (data.MinimumPropertyInfos as MinInfo[] | undefined) ?? [];
  return list
    .filter((m) => m.Strap)
    .map((m) => {
      const folioRaw = (m.Strap ?? "").replace(/\D/g, "");
      const owner = [m.Owner1, m.Owner2, m.Owner3]
        .filter(Boolean)
        .join(", ");
      return {
        folio: formatFolio(folioRaw),
        folioRaw,
        siteAddress: [m.SiteAddress, m.SiteUnit].filter(Boolean).join(" "),
        owner,
        status: m.Status ?? "",
      };
    });
}

/**
 * Top-level lookup. Accepts an address or folio (auto-detected unless forced).
 * For an address with multiple matches, returns the best match fully resolved
 * plus the remaining matches as `alternates` for disambiguation.
 */
export async function lookupOwner(
  query: string,
  forcedType?: QueryType,
  signal?: AbortSignal,
): Promise<OwnerLookupResult> {
  const queryType = forcedType ?? detectQueryType(query);
  const fetchedAt = new Date().toISOString();

  if (queryType === "folio") {
    const raw = normalizeFolio(query);
    const match = raw ? await getOwnerByFolio(raw, signal) : null;
    return { query, queryType, match, alternates: [], source: SOURCE, fetchedAt };
  }

  const matches = await searchByAddress(query, signal);
  if (matches.length === 0) {
    return { query, queryType, match: null, alternates: [], source: SOURCE, fetchedAt };
  }

  const [best, ...rest] = matches;
  const match = await getOwnerByFolio(best.folioRaw, signal);
  return {
    query,
    queryType,
    match,
    alternates: rest.slice(0, 12),
    source: SOURCE,
    fetchedAt,
  };
}
