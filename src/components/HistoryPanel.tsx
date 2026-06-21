"use client";

import { useEffect, useState } from "react";
import type { HistoryItem, QueryType } from "@/lib/types";

type Status = "loading" | "ok" | "not_configured" | "error";

function fmtFolio(raw: string): string {
  return raw.length === 13
    ? `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`
    : raw;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPanel({
  refreshKey,
  onPick,
}: {
  refreshKey: number;
  onPick: (query: string, type: QueryType) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch("/api/history")
      .then((r) => r.json())
      .then((d: { status: Status; items: HistoryItem[] }) => {
        if (cancelled) return;
        if (d.status === "not_configured") {
          setItems([]);
          setStatus("not_configured");
          return;
        }
        setItems(d.items ?? []);
        setStatus(d.status === "ok" ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div>
      <h2 className="mb-1 text-xl font-medium" style={{ color: "var(--ink)" }}>
        Lookup history
      </h2>
      <p className="mb-5 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Your recent property lookups. Select one to run it again.
      </p>

      {status === "loading" && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      )}

      {status === "not_configured" && (
        <div
          className="rounded-lg border border-dashed p-4 text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink-muted)" }}
        >
          History needs Supabase configured (it isn’t in this environment).
        </div>
      )}

      {status === "error" && (
        <div
          className="rounded-lg border p-4 text-[13px]"
          style={{ borderColor: "var(--danger-fg)", color: "var(--danger-fg)" }}
        >
          Couldn’t load history.
        </div>
      )}

      {status === "ok" && items.length === 0 && (
        <div
          className="rounded-lg border p-6 text-center text-[14px]"
          style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
        >
          No lookups yet. Run a search and it’ll show up here.
        </div>
      )}

      {status === "ok" && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, i) => {
            const reType: QueryType =
              it.folioRaw ? "folio" : it.queryType;
            const reQuery = it.folioRaw ? fmtFolio(it.folioRaw) : it.query;
            const title = it.matched
              ? it.ownerName ?? it.siteAddress ?? it.query
              : it.query;
            const sub = it.matched
              ? it.siteAddress ?? it.query
              : "No match";
            return (
              <button
                key={`${it.createdAt}-${i}`}
                onClick={() => onPick(reQuery, reType)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="min-w-0">
                  <span
                    className="flex items-center gap-2 truncate text-[14px]"
                    style={{ color: "var(--ink)" }}
                  >
                    <span className="truncate">{title}</span>
                    {!it.matched && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--danger-bg)",
                          color: "var(--danger-fg)",
                        }}
                      >
                        no match
                      </span>
                    )}
                  </span>
                  <span
                    className="block truncate text-[12px]"
                    style={{ color: "var(--ink-hint)" }}
                  >
                    {it.queryType === "folio" ? "Folio" : "Address"} · “{it.query}” · {sub}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[12px]"
                  style={{ color: "var(--ink-hint)" }}
                >
                  {timeAgo(it.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
