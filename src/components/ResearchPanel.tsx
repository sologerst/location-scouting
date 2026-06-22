"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import {
  LAND_USE_GROUPS,
  type LandUseKey,
  type ResearchResult,
} from "@/lib/research";
import type { QueryType } from "@/lib/types";

const ResearchMap = dynamic(() => import("./ResearchMap"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 380 }} />,
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const LAND_USE_KEYS = Object.keys(LAND_USE_GROUPS) as LandUseKey[];

type Phase = "idle" | "loading" | "done" | "error";

export default function ResearchPanel({
  onPick,
}: {
  onPick: (query: string, type: QueryType) => void;
}) {
  const [noStructures, setNoStructures] = useState(true);
  const [minAcres, setMinAcres] = useState("3");
  const [maxAcres, setMaxAcres] = useState("30");
  const [landUse, setLandUse] = useState<LandUseKey[]>(["agricultural"]);
  const [zones, setZones] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const toggleUse = (k: LandUseKey) =>
    setLandUse((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const buildParams = (offset: number) => {
    const p = new URLSearchParams();
    if (noStructures) p.set("noStructures", "true");
    if (minAcres) p.set("minAcres", minAcres);
    if (maxAcres) p.set("maxAcres", maxAcres);
    if (landUse.length) p.set("landUse", landUse.join(","));
    if (zones.trim()) p.set("zones", zones);
    if (minValue) p.set("minValue", minValue);
    if (maxValue) p.set("maxValue", maxValue);
    p.set("offset", String(offset));
    return p;
  };

  const hasAnyFilter =
    noStructures ||
    !!minAcres ||
    !!maxAcres ||
    landUse.length > 0 ||
    !!zones.trim() ||
    !!minValue ||
    !!maxValue;

  const search = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setResults([]);
    offsetRef.current = 0;
    try {
      const res = await fetch(`/api/research?${buildParams(0)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Search failed (${res.status}).`);
      setCount(data.count);
      setResults(data.results);
      setHasMore(data.hasMore);
      offsetRef.current = data.results.length;
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noStructures, minAcres, maxAcres, landUse, zones, minValue, maxValue]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/research?${buildParams(offsetRef.current)}`);
      const data = await res.json();
      if (res.ok) {
        setResults((prev) => [...prev, ...data.results]);
        setHasMore(data.hasMore);
        offsetRef.current += data.results.length;
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-medium" style={{ color: "var(--ink)" }}>
        Research parcels
      </h2>
      <p className="mb-5 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Find Miami-Dade parcels by criteria — land use, acreage, structures,
        zoning, value. Select a result to pull the owner and contacts.
      </p>

      <div className="card mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 text-[14px]" style={{ color: "var(--ink)" }}>
            <input
              type="checkbox"
              checked={noStructures}
              onChange={(e) => setNoStructures(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--brand)" }}
            />
            No structures (vacant / no home)
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Acres
            </span>
            <input
              className="field"
              style={{ height: 40 }}
              type="number"
              inputMode="decimal"
              placeholder="min"
              value={minAcres}
              onChange={(e) => setMinAcres(e.target.value)}
            />
            <span style={{ color: "var(--ink-hint)" }}>–</span>
            <input
              className="field"
              style={{ height: 40 }}
              type="number"
              inputMode="decimal"
              placeholder="max"
              value={maxAcres}
              onChange={(e) => setMaxAcres(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>
            Land use
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LAND_USE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className="seg"
                data-active={landUse.includes(k)}
                onClick={() => toggleUse(k)}
              >
                {LAND_USE_GROUPS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Value $
            </span>
            <input
              className="field"
              style={{ height: 40 }}
              type="number"
              inputMode="numeric"
              placeholder="min"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
            />
            <span style={{ color: "var(--ink-hint)" }}>–</span>
            <input
              className="field"
              style={{ height: 40 }}
              type="number"
              inputMode="numeric"
              placeholder="max"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Zone codes
            </span>
            <input
              className="field"
              style={{ height: 40 }}
              type="text"
              placeholder="e.g. 9000, 7200 (optional)"
              value={zones}
              onChange={(e) => setZones(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-primary"
            onClick={search}
            disabled={phase === "loading" || !hasAnyFilter}
          >
            {phase === "loading" ? "Searching…" : "Search parcels"}
          </button>
          {!hasAnyFilter && (
            <span className="text-[12px]" style={{ color: "var(--ink-hint)" }}>
              Add at least one filter.
            </span>
          )}
        </div>
      </div>

      {phase === "error" && (
        <div
          className="rounded-lg border p-4 text-[14px]"
          style={{ borderColor: "var(--danger-fg)", background: "var(--danger-bg)", color: "var(--danger-fg)" }}
        >
          {error}
        </div>
      )}

      {phase === "loading" && <div className="skeleton" style={{ height: 380 }} />}

      {phase === "done" && (
        <>
          <p className="mb-3 text-[14px]" style={{ color: "var(--ink-muted)" }}>
            <span className="font-medium" style={{ color: "var(--ink)" }}>
              {count.toLocaleString()}
            </span>{" "}
            {count === 1 ? "parcel" : "parcels"} match
            {count > results.length && (
              <span> — showing {results.length.toLocaleString()} (largest first)</span>
            )}
          </p>

          {results.length === 0 ? (
            <div
              className="rounded-lg border p-6 text-center text-[14px]"
              style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
            >
              No parcels match these filters. Try widening the criteria.
            </div>
          ) : (
            <>
              <div className="mb-4">
                <ResearchMap results={results} onPick={(folio) => onPick(folio, "folio")} />
              </div>

              <div className="space-y-1.5">
                {results.map((r) => (
                  <button
                    key={r.folio}
                    onClick={() => onPick(r.folio, "folio")}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]" style={{ color: "var(--ink)" }}>
                        {r.owner || "—"}
                      </span>
                      <span className="block truncate text-[12px]" style={{ color: "var(--ink-hint)" }}>
                        {r.acres.toFixed(1)} ac · {titleCase(r.dorDesc)}
                        {r.zone ? ` · zone ${r.zone}` : ""}
                        {r.siteAddress ? ` · ${r.siteAddress}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12px]" style={{ color: "var(--ink-hint)" }}>
                      {r.totalValue != null ? currency.format(r.totalValue) : "—"}
                      <span className="block">{r.folio}</span>
                    </span>
                  </button>
                ))}
              </div>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function titleCase(s: string): string {
  return s ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}
