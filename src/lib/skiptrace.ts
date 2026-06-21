// Contact enrichment ("skip trace") — provider-agnostic adapter.
//
// This is the deliberately-pluggable half. Owner data is authoritative (county);
// contact data is probabilistic third-party data and is gated behind compliance.
//
// Configure with env:
//   SKIPTRACE_PROVIDER = "apify" | "mock" | (unset → not_configured)
//   APIFY_TOKEN        = <token>  (when provider = apify)
//   APIFY_SKIPTRACE_ACTOR = "one-api~skip-trace"  (optional override)
//
// IMPORTANT (compliance): enrichment results must NOT be used for FCRA-regulated
// eligibility decisions (tenant/credit/employment screening). Numbers must be
// DNC-scrubbed before outreach. See COMPLIANCE.md.

import type {
  ContactDatum,
  ContactResult,
  MailingAddress,
  OwnerRecord,
} from "./types";

export interface EnrichInput {
  name: string;
  ownerKind: OwnerRecord["ownerKind"];
  mailingAddress: MailingAddress | null;
  siteAddress?: string;
}

function citystatezip(m: MailingAddress): string {
  return `${m.city}, ${m.state} ${m.zip}`.replace(/\s+/g, " ").trim();
}

// ---------- Apify one-api Skip Trace adapter ----------
// Docs: https://apify.com/one-api/skip-trace/api
// Verified actor input (arrays of "<thing>; <city, state zip>"):
//   street_citystatezip, name, phone_number, email, max_results
// Verified output per person record: First/Last Name, Email-1..5,
//   Phone-1..5 with "Phone-N Type" / "Phone-N Provider" / "Phone-N Last Reported".

interface ApifyPersonItem {
  [key: string]: unknown;
}

const STR = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

async function enrichViaApify(
  input: EnrichInput,
  signal?: AbortSignal,
): Promise<ContactResult> {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_SKIPTRACE_ACTOR || "one-api~skip-trace";
  const fetchedAt = new Date().toISOString();

  if (!token) {
    return {
      status: "not_configured",
      subject: input.name,
      contacts: [],
      provider: "apify",
      message: "APIFY_TOKEN is not set.",
      fetchedAt,
    };
  }

  const m = input.mailingAddress;
  if (!m || !m.line1) {
    return {
      status: "no_match",
      subject: input.name,
      contacts: [],
      provider: "apify",
      message: "No mailing address available to skip-trace.",
      fetchedAt,
    };
  }

  // Inputs are arrays. Anchor on the mailing address; for individuals also
  // search by name (most precise for a person).
  const csz = citystatezip(m);
  const body: Record<string, unknown> = {
    street_citystatezip: [`${m.line1}; ${csz}`],
    max_results: 4,
  };
  if (input.ownerKind === "individual") {
    body.name = [`${input.name}; ${csz}`];
  }

  // run-sync-get-dataset-items: run the actor and get results in one call.
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    return {
      status: "error",
      subject: input.name,
      contacts: [],
      provider: "apify",
      message: `Apify actor returned HTTP ${res.status}`,
      fetchedAt,
    };
  }

  const items = (await res.json()) as ApifyPersonItem[];
  const contacts = parseApifyItems(items, input);
  return {
    status: contacts.length > 0 ? "ok" : "no_match",
    subject: input.name,
    contacts,
    provider: "apify",
    fetchedAt,
  };
}

/** Rough confidence from the actor's "Last reported <Mon YYYY>" recency. */
function recencyConfidence(lastReported: string): number | null {
  const match = lastReported.match(/(\d{4})/);
  if (!match) return null;
  const age = new Date().getFullYear() - parseInt(match[1], 10);
  if (age <= 1) return 90;
  if (age <= 3) return 78;
  if (age <= 6) return 60;
  if (age <= 10) return 45;
  return 30;
}

/**
 * Person records → ContactDatum[] (up to 5 phones / 5 emails each). For
 * individual owners, prefer records whose surname matches the owner of record;
 * fall back to all records if none match. Dedupes across records.
 */
function parseApifyItems(
  items: ApifyPersonItem[],
  input: EnrichInput,
): ContactDatum[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  let pool = items;
  if (input.ownerKind === "individual") {
    const lastName = input.name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
    const matched = items.filter(
      (it) =>
        lastName.length > 1 &&
        STR(it["Last Name"]).toLowerCase() === lastName,
    );
    if (matched.length) pool = matched;
  }

  const out: ContactDatum[] = [];
  const seen = new Set<string>();

  for (const item of pool) {
    const personName = [STR(item["First Name"]), STR(item["Last Name"])]
      .filter(Boolean)
      .join(" ");
    for (let i = 1; i <= 5; i++) {
      const phone = STR(item[`Phone-${i}`]);
      if (phone) {
        const key = `phone:${phone.replace(/\D/g, "")}`;
        if (!seen.has(key)) {
          seen.add(key);
          const provider = STR(item[`Phone-${i} Provider`]);
          out.push({
            kind: "phone",
            value: phone,
            confidence: recencyConfidence(STR(item[`Phone-${i} Last Reported`])),
            lineType: STR(item[`Phone-${i} Type`]) || undefined,
            source:
              [provider, personName].filter(Boolean).join(" · ") ||
              "people-search",
            dnc: null,
          });
        }
      }
      const email = STR(item[`Email-${i}`]);
      if (email.includes("@")) {
        const key = `email:${email.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            kind: "email",
            value: email,
            confidence: null,
            source: personName || "people-search",
          });
        }
      }
    }
  }

  // phones first, then most-recently-reported first
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "phone" ? -1 : 1;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
  return out;
}

// ---------- Mock adapter (for local dev / demos without a paid key) ----------

function enrichMock(input: EnrichInput): ContactResult {
  const fetchedAt = new Date().toISOString();
  const isBiz = input.ownerKind === "business";
  return {
    status: "ok",
    subject: input.name,
    provider: "mock",
    message: "Sample data — set SKIPTRACE_PROVIDER to a real provider.",
    fetchedAt,
    contacts: [
      {
        kind: "phone",
        value: "(305) 555-0142",
        confidence: isBiz ? 84 : 71,
        lineType: isBiz ? "Landline" : "Wireless",
        source: isBiz ? "business registry" : "people-search",
        dnc: false,
      },
      {
        kind: "email",
        value: isBiz
          ? "info@" +
            input.name
              .toLowerCase()
              .replace(/[^a-z]+/g, "")
              .slice(0, 14) +
            ".com"
          : "contact@example.com",
        confidence: 66,
        source: "web domain",
      },
    ],
  };
}

// ---------- public entry ----------

export async function enrichContacts(
  input: EnrichInput,
  signal?: AbortSignal,
): Promise<ContactResult> {
  const provider = (process.env.SKIPTRACE_PROVIDER || "").toLowerCase();

  switch (provider) {
    case "apify":
      return enrichViaApify(input, signal);
    case "mock":
      return enrichMock(input);
    default:
      return {
        status: "not_configured",
        subject: input.name,
        contacts: [],
        provider: null,
        message:
          "Contact enrichment is not configured. Set SKIPTRACE_PROVIDER (apify|mock).",
        fetchedAt: new Date().toISOString(),
      };
  }
}
