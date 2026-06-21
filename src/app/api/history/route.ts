import { NextResponse } from "next/server";
import { isSupabaseConfigured, readHistory } from "@/lib/supabase";

// Recent lookup history (from Supabase search_history).
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "not_configured", items: [] });
  }
  const items = await readHistory(50);
  return NextResponse.json({
    status: items ? "ok" : "error",
    items: items ?? [],
  });
}
