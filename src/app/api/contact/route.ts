import { NextRequest, NextResponse } from "next/server";
import { enrichContacts, type EnrichInput } from "@/lib/skiptrace";
import type { MailingAddress, OwnerRecord } from "@/lib/types";

// Contact enrichment ("skip trace") — probabilistic / "enriched" tier.
// POST body: { name, ownerKind, mailingAddress, siteAddress }
export async function POST(req: NextRequest) {
  let body: Partial<EnrichInput>;
  try {
    body = (await req.json()) as Partial<EnrichInput>;
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

  const input: EnrichInput = {
    name,
    ownerKind: (body.ownerKind as OwnerRecord["ownerKind"]) ?? "unknown",
    mailingAddress: (body.mailingAddress as MailingAddress | null) ?? null,
    siteAddress: body.siteAddress,
  };

  try {
    const result = await enrichContacts(input);
    return NextResponse.json(result);
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
