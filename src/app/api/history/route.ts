import { NextRequest, NextResponse } from "next/server";
import {
  clearHistory,
  deleteHistory,
  isSupabaseConfigured,
  readHistory,
} from "@/lib/supabase";

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

// Delete one row (?id=) or all (?all=true).
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);

  if (searchParams.get("all") === "true") {
    const ok = await clearHistory();
    return NextResponse.json({ status: ok ? "ok" : "error" });
  }

  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing or invalid `id`." }, { status: 400 });
  }
  const ok = await deleteHistory(id);
  return NextResponse.json({ status: ok ? "ok" : "error" });
}
