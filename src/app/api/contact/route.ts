import { NextRequest, NextResponse } from "next/server";
import { enrichContacts, type EnrichInput } from "@/lib/skiptrace";
import { readContactCache, writeContactCache } from "@/lib/supabase";
import type { MailingAddress, OwnerRecord } from "@/lib/types";

interface ContactBody extends Partial<EnrichInput> {
  /** folio of the property — used as the cache key */
  folio?: string;
  /** force a fresh provider call even if a saved result exists */
  force?: boolean;
}

// Contact enrichment ("skip trace") — probabilistic / "enriched" tier.
// Saved per folio so revisiting a property doesn't re-hit the paid provider.
export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Missing `name` to enrich." },
      { status: 400 },
    );
  }

  const folio = (body.folio ?? "").replace(/\D/g, "") || null;

  // Serve a saved result unless a refresh is explicitly requested.
  if (folio && !body.force) {
    const cached = await readContactCache(folio);
    if (cached) return NextResponse.json(cached);
  }

  const input: EnrichInput = {
    name,
    ownerKind: (body.ownerKind as OwnerRecord["ownerKind"]) ?? "unknown",
    mailingAddress: (body.mailingAddress as MailingAddress | null) ?? null,
    siteAddress: body.siteAddress,
    searchName: body.searchName ?? null,
  };

  try {
    const result = await enrichContacts(input);
    // Cache only definitive results (a real hit or a confirmed no-match),
    // never errors / not-configured — and only when we have a folio key.
    if (folio && (result.status === "ok" || result.status === "no_match")) {
      void writeContactCache(folio, result);
    }
    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contact enrichment failed.";
    return NextResponse.json(
      {
        status: "error",
        subject: name,
        contacts: [],
        provider: null,
        message,
        fetchedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
