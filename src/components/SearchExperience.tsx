"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ContactResult,
  OwnerLookupResult,
  OwnerMatch,
  QueryType,
} from "@/lib/types";
import OwnerCard from "./OwnerCard";
import ContactPanel, { type ContactPhase } from "./ContactPanel";

type OwnerPhase = "idle" | "loading" | "done" | "error";

export interface SearchTrigger {
  q: string;
  type: QueryType;
  nonce: number;
}

export default function SearchExperience({
  trigger,
}: {
  trigger?: SearchTrigger | null;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QueryType>("address");

  const [ownerPhase, setOwnerPhase] = useState<OwnerPhase>("idle");
  const [owner, setOwner] = useState<OwnerLookupResult | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const [contactPhase, setContactPhase] = useState<ContactPhase>("idle");
  const [contact, setContact] = useState<ContactResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const enrich = useCallback(async (lookup: OwnerLookupResult, signal: AbortSignal) => {
    if (!lookup.match) {
      setContactPhase("idle");
      return;
    }
    setContactPhase("loading");
    setContact(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          name: lookup.match.owners[0]?.name,
          ownerKind: lookup.match.ownerKind,
          mailingAddress: lookup.match.mailingAddress,
          siteAddress: lookup.match.siteAddress,
        }),
      });
      const data = (await res.json()) as ContactResult;
      setContact(data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setContact({
        status: "error",
        subject: lookup.match.owners[0]?.name ?? "",
        contacts: [],
        provider: null,
        message: "Contact lookup failed.",
        fetchedAt: new Date().toISOString(),
      });
    } finally {
      setContactPhase("done");
    }
  }, []);

  const run = useCallback(
    async (q: string, type: QueryType) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setOwnerPhase("loading");
      setOwner(null);
      setOwnerError(null);
      setContact(null);
      setContactPhase("idle");

      const params = new URLSearchParams({ q: trimmed, type });

      try {
        const res = await fetch(`/api/owner?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Lookup failed (${res.status}).`);
        }
        const data = (await res.json()) as OwnerLookupResult;
        setOwner(data);
        setOwnerPhase("done");
        void enrich(data, ctrl.signal);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setOwnerError((e as Error).message);
        setOwnerPhase("error");
      }
    },
    [enrich],
  );

  // Replay a lookup requested from the History tab.
  useEffect(() => {
    if (!trigger) return;
    setQuery(trigger.q);
    setMode(trigger.type);
    void run(trigger.q, trigger.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.nonce]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(query, mode);
  };

  const pickAlternate = (m: OwnerMatch) => {
    setQuery(m.folio);
    setMode("folio");
    void run(m.folioRaw, "folio");
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="field"
          placeholder={
            mode === "folio"
              ? "01-4139-117-0010"
              : "1450 Brickell Ave, Miami, FL"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={mode === "folio" ? "Folio number" : "Street address"}
          inputMode={mode === "folio" ? "numeric" : "text"}
          autoFocus
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={ownerPhase === "loading" || !query.trim()}
        >
          {ownerPhase === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-2.5 flex items-center gap-1.5" role="group" aria-label="Search by">
        {(["address", "folio"] as QueryType[]).map((m) => (
          <button
            key={m}
            type="button"
            className="seg"
            data-active={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "address" ? "Address" : "Folio #"}
          </button>
        ))}
      </div>

      {ownerPhase === "error" && (
        <div
          className="mt-6 rounded-lg border p-4 text-[14px]"
          style={{
            borderColor: "var(--danger-fg)",
            background: "var(--danger-bg)",
            color: "var(--danger-fg)",
          }}
        >
          {ownerError}
        </div>
      )}

      {ownerPhase === "done" && owner && !owner.match && (
        <div
          className="mt-6 rounded-lg border p-5 text-center"
          style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
        >
          <p className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
            No property found
          </p>
          <p className="mt-1 text-[13px]">
            Nothing matched “{owner.query}”. Check the spelling, or switch to{" "}
            {mode === "address" ? "folio" : "address"} search.
          </p>
        </div>
      )}

      {(ownerPhase === "loading" || (ownerPhase === "done" && owner?.match)) && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ownerPhase === "loading" ? <OwnerSkeleton /> : <OwnerCard record={owner!.match!} />}
          <ContactPanel phase={contactPhase} result={contact} />
        </div>
      )}

      {ownerPhase === "done" && owner && owner.alternates.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Other matches for this address
          </p>
          <div className="space-y-1.5">
            {owner.alternates.map((m) => (
              <button
                key={m.folioRaw}
                onClick={() => pickAlternate(m)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px]" style={{ color: "var(--ink)" }}>
                    {m.siteAddress || m.folio}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--ink-hint)" }}>
                    {m.owner}
                  </span>
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: "var(--ink-hint)" }}>
                  {m.folio}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerSkeleton() {
  return (
    <div className="card">
      <div className="skeleton mb-3 h-4 w-32" />
      <div className="skeleton h-6 w-2/3" />
      <div className="skeleton mt-2 h-3.5 w-1/2" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}
