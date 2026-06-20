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

function fullMailing(m: MailingAddress | null): string {
  if (!m) return "";
  return [m.line1, m.line2, m.city, m.state, m.zip]
    .filter(Boolean)
    .join(", ");
}

// ---------- Apify one-api Skip Trace adapter ----------
// Docs: https://apify.com/one-api/skip-trace/api
// Accepts an address (and/or name) → up to 5 phones + 5 emails per person.

interface ApifyPersonItem {
  [key: string]: unknown;
}

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

  // run-sync-get-dataset-items: run the actor and get results in one call
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`;
  const body = {
    // The actor accepts address and/or name; we pass what we have.
    street_citystatezip: fullMailing(input.mailingAddress) || input.siteAddress,
    name: input.name,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const contacts = parseApifyItems(items);
  return {
    status: contacts.length > 0 ? "ok" : "no_match",
    subject: input.name,
    contacts,
    provider: "apify",
    fetchedAt,
  };
}

/** The actor emits messy/variable JSON; pull Phone-1..5 / Email-1..5 defensively. */
function parseApifyItems(items: ApifyPersonItem[]): ContactDatum[] {
  const out: ContactDatum[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (let i = 1; i <= 5; i++) {
      const phone = item[`Phone-${i}`] ?? item[`phone${i}`];
      if (typeof phone === "string" && phone.trim()) {
        const key = `phone:${phone}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            kind: "phone",
            value: phone.trim(),
            confidence: null,
            lineType:
              (item[`Phone-${i}-Type`] as string | undefined) ?? undefined,
            source: "people-search",
            dnc: null,
          });
        }
      }
      const email = item[`Email-${i}`] ?? item[`email${i}`];
      if (typeof email === "string" && email.includes("@")) {
        const key = `email:${email.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            kind: "email",
            value: email.trim(),
            confidence: null,
            source: "people-search",
          });
        }
      }
    }
  }
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
