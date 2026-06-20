// Shared domain types for Location Scouting

export type QueryType = "address" | "folio";

export interface OwnerName {
  name: string;
  percentOwn: number;
}

export interface MailingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

/** Normalized, authoritative owner-of-record record from Miami-Dade County. */
export interface OwnerRecord {
  folio: string; // formatted 99-9999-999-9999
  folioRaw: string; // 13 digits
  siteAddress: string;
  owners: OwnerName[];
  mailingAddress: MailingAddress | null;
  propertyType: string | null; // DOR description
  municipality: string | null;
  neighborhood: string | null;
  assessedValue: number | null;
  totalValue: number | null;
  rollYear: number | null;
  /** heuristic: is the owner an entity (LLC/Corp/Trust) vs an individual */
  ownerKind: "business" | "individual" | "government" | "unknown";
}

/** A lightweight match used when an address search returns multiple parcels. */
export interface OwnerMatch {
  folio: string;
  folioRaw: string;
  siteAddress: string;
  owner: string;
  status: string;
}

export interface OwnerLookupResult {
  query: string;
  queryType: QueryType;
  match: OwnerRecord | null;
  alternates: OwnerMatch[];
  source: string;
  fetchedAt: string;
}

// ---- Contact enrichment ----

export type ContactKind = "phone" | "email";

export interface ContactDatum {
  kind: ContactKind;
  value: string;
  /** 0-100 confidence from the enrichment provider, when available */
  confidence: number | null;
  /** e.g. "Wireless", "Landline" for phones */
  lineType?: string;
  /** provider-reported source, e.g. "business registry", "people-search" */
  source: string;
  /** result of a Do-Not-Call scrub, when run */
  dnc?: boolean | null;
}

export type ContactStatus =
  | "ok"
  | "no_match"
  | "not_configured"
  | "error";

export interface ContactResult {
  status: ContactStatus;
  /** which person/entity we attempted to resolve */
  subject: string;
  contacts: ContactDatum[];
  provider: string | null;
  message?: string;
  fetchedAt: string;
}
