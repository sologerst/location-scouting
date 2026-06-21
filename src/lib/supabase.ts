// Supabase — optional. The app fully functions without it; when configured it
// is used to cache county lookups and log search history.
//
// env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (server-only; used by API routes)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HistoryItem, OwnerLookupResult } from "./types";

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Best-effort cache read of a prior owner lookup by folio. Never throws. */
export async function readOwnerCache(
  folioRaw: string,
): Promise<OwnerLookupResult | null> {
  const db = getServiceClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("owner_lookups")
      .select("result, fetched_at")
      .eq("folio_raw", folioRaw)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.result as OwnerLookupResult) ?? null;
  } catch {
    return null;
  }
}

/** Best-effort write of an owner lookup + search-history row. Never throws. */
export async function recordLookup(
  query: string,
  result: OwnerLookupResult,
): Promise<void> {
  const db = getServiceClient();
  if (!db) return;
  try {
    if (result.match) {
      await db.from("owner_lookups").upsert(
        {
          folio_raw: result.match.folioRaw,
          site_address: result.match.siteAddress,
          owner_name: result.match.owners[0]?.name ?? null,
          result,
          fetched_at: result.fetchedAt,
        },
        { onConflict: "folio_raw" },
      );
    }
    await db.from("search_history").insert({
      query,
      query_type: result.queryType,
      matched: Boolean(result.match),
      folio_raw: result.match?.folioRaw ?? null,
      owner_name: result.match?.owners[0]?.name ?? null,
      site_address: result.match?.siteAddress ?? null,
    });
  } catch {
    // swallow — telemetry must never break the request
  }
}

interface HistoryRow {
  query: string;
  query_type: string;
  matched: boolean;
  folio_raw: string | null;
  owner_name: string | null;
  site_address: string | null;
  created_at: string;
}

/** Recent search history (most recent first). Returns null if Supabase is off. */
export async function readHistory(
  limit = 50,
): Promise<HistoryItem[] | null> {
  const db = getServiceClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("search_history")
      .select(
        "query,query_type,matched,folio_raw,owner_name,site_address,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data as HistoryRow[]) ?? []).map((r) => ({
      query: r.query,
      queryType: r.query_type === "folio" ? "folio" : "address",
      matched: r.matched,
      folioRaw: r.folio_raw,
      ownerName: r.owner_name,
      siteAddress: r.site_address,
      createdAt: r.created_at,
    }));
  } catch {
    return null;
  }
}
