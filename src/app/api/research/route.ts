import { NextRequest, NextResponse } from "next/server";
import {
  runResearch,
  type LandUseKey,
  type ResearchFilters,
} from "@/lib/research";

// Criteria-based parcel search (Miami-Dade PaGis layer).
export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);

  const num = (key: string): number | undefined => {
    const v = p.get(key);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const list = (key: string): string[] =>
    (p.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const filters: ResearchFilters = {
    noStructures: p.get("noStructures") === "true",
    minAcres: num("minAcres"),
    maxAcres: num("maxAcres"),
    landUse: list("landUse") as LandUseKey[],
    zones: list("zones"),
    minValue: num("minValue"),
    maxValue: num("maxValue"),
  };

  const offset = num("offset") ?? 0;

  try {
    const data = await runResearch(filters, offset, 250);
    if (!data.where) {
      return NextResponse.json(
        { error: "Add at least one filter." },
        { status: 400 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research query failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
