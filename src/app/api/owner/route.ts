import { NextRequest, NextResponse } from "next/server";
import { lookupOwner } from "@/lib/miami-dade";
import { readOwnerCache, recordLookup } from "@/lib/supabase";
import { normalizeFolio } from "@/lib/miami-dade";
import type { QueryType } from "@/lib/types";

// Owner-of-record lookup against Miami-Dade County (authoritative / "verified").
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();
  const typeParam = searchParams.get("type") as QueryType | null;

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter `q`." },
      { status: 400 },
    );
  }

  try {
    // serve fresh-enough cache for folio queries when available
    const folioRaw = normalizeFolio(query);
    if (folioRaw && (typeParam === "folio" || !typeParam)) {
      const cached = await readOwnerCache(folioRaw);
      if (cached) return NextResponse.json(cached);
    }

    const result = await lookupOwner(query, typeParam ?? undefined);
    // fire-and-forget cache/telemetry
    void recordLookup(query, result);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Owner lookup failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
