"use client";

import { useState } from "react";
import type { ContactDatum, ContactResult } from "@/lib/types";

export type ContactPhase = "idle" | "loading" | "done";

function ConfidencePill({ value }: { value: number | null }) {
  if (value == null) return null;
  const tone =
    value >= 80 ? "var(--verified-fg)" : value >= 50 ? "var(--enriched-fg)" : "var(--danger-fg)";
  return (
    <span className="text-[11px]" style={{ color: tone }}>
      {Math.round(value)}%
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost"
      aria-label={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ContactRow({ datum }: { datum: ContactDatum }) {
  const isPhone = datum.kind === "phone";
  const href = isPhone ? `tel:${datum.value.replace(/[^\d+]/g, "")}` : `mailto:${datum.value}`;
  const meta = [
    datum.lineType,
    datum.source,
    datum.dnc === true ? "on DNC" : datum.dnc === false ? "DNC clear" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const blockedByDnc = isPhone && datum.dnc === true;

  return (
    <div
      className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px]" style={{ color: "var(--ink)" }}>
            {datum.value}
          </span>
          <ConfidencePill value={datum.confidence} />
        </div>
        <p className="truncate text-[11px]" style={{ color: "var(--ink-hint)" }}>
          {meta || "unverified"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <a
          className="btn-ghost"
          href={href}
          aria-disabled={blockedByDnc}
          onClick={(e) => blockedByDnc && e.preventDefault()}
          style={blockedByDnc ? { opacity: 0.45, pointerEvents: "none" } : undefined}
          title={blockedByDnc ? "Number is on the Do-Not-Call registry" : undefined}
        >
          {isPhone ? "Call" : "Email"}
        </a>
        <CopyButton value={datum.value} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 py-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="w-full space-y-1.5">
            <div className="skeleton h-3.5 w-2/3" />
            <div className="skeleton h-2.5 w-1/3" />
          </div>
          <div className="skeleton h-8 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function ContactPanel({
  phase,
  result,
}: {
  phase: ContactPhase;
  result: ContactResult | null;
}) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Contact info
        </span>
        <span className="badge badge-enriched">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Enriched · likely
        </span>
      </div>

      {phase === "idle" && (
        <p className="py-4 text-[13px]" style={{ color: "var(--ink-hint)" }}>
          Find an owner first — contacts load automatically.
        </p>
      )}

      {phase === "loading" && (
        <>
          <SkeletonRows />
          <div className="mt-2 flex items-center gap-2">
            <span className="spinner" />
            <span className="text-[12px]" style={{ color: "var(--ink-hint)" }}>
              Searching contact sources…
            </span>
          </div>
        </>
      )}

      {phase === "done" && result && (
        <ContactBody result={result} />
      )}

      <p
        className="mt-3 flex items-start gap-1.5 text-[11px]"
        style={{ color: "var(--ink-hint)" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Enriched contact data is third-party and may be inaccurate. Verify and
        DNC-scrub before outreach. Not for FCRA-regulated use.
      </p>
    </div>
  );
}

function ContactBody({ result }: { result: ContactResult }) {
  if (result.status === "ok") {
    return (
      <div>
        {result.contacts.map((c, i) => (
          <ContactRow key={`${c.kind}-${i}`} datum={c} />
        ))}
        {result.provider === "mock" && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--enriched-fg)" }}>
            Sample data (mock provider).
          </p>
        )}
      </div>
    );
  }

  if (result.status === "not_configured") {
    return (
      <div
        className="rounded-lg border border-dashed p-3.5 text-[13px]"
        style={{ borderColor: "var(--enriched-border)", color: "var(--ink-muted)" }}
      >
        <p className="font-medium" style={{ color: "var(--enriched-fg)" }}>
          Contact enrichment not configured
        </p>
        <p className="mt-1">
          Owner data is live. To enable phone/email lookup, set a skip-trace
          provider (<code>SKIPTRACE_PROVIDER</code>) once the data vendor and
          compliance terms are settled.
        </p>
      </div>
    );
  }

  if (result.status === "no_match") {
    return (
      <p className="py-3 text-[13px]" style={{ color: "var(--ink-muted)" }}>
        No contact info found for {result.subject}.
      </p>
    );
  }

  return (
    <p className="py-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
      {result.message ?? "Contact lookup failed."}
    </p>
  );
}
