import type { OwnerRecord } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const KIND_LABEL: Record<OwnerRecord["ownerKind"], string> = {
  business: "Business / entity",
  individual: "Individual",
  government: "Government",
  trust: "Trust",
  unknown: "Owner",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[13px]" style={{ color: "var(--ink-hint)" }}>
        {label}
      </span>
      <span
        className="min-w-0 break-words text-right text-[13px]"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function OwnerCard({ record }: { record: OwnerRecord }) {
  const mailing = record.mailingAddress;
  const mailingStr = mailing
    ? [mailing.line1, mailing.line2, `${mailing.city}, ${mailing.state} ${mailing.zip}`]
        .filter(Boolean)
        .join(", ")
    : "—";

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Owner of record
        </span>
        <span className="badge badge-verified">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Verified · County
        </span>
      </div>

      <p className="text-lg font-medium leading-snug" style={{ color: "var(--ink)" }}>
        {record.owners[0]?.name ?? "Unknown owner"}
      </p>
      {record.owners.length > 1 && (
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--ink-muted)" }}>
          + {record.owners.slice(1).map((o) => o.name).join(", ")}
        </p>
      )}
      <p className="mt-1 text-[13px]" style={{ color: "var(--ink-muted)" }}>
        {KIND_LABEL[record.ownerKind]}
        {record.propertyType ? ` · ${titleCase(record.propertyType)}` : ""}
      </p>

      {record.ownerKind === "trust" && record.trustInfo && (
        <div
          className="mt-3 rounded-lg p-3 text-[13px]"
          style={{ background: "var(--enriched-bg)" }}
        >
          {record.trustInfo.person ? (
            <p style={{ color: "var(--enriched-fg)" }}>
              <span className="font-medium">Likely trustee/grantor:</span>{" "}
              {titleCase(record.trustInfo.person)}
              <span className="block text-[11px]" style={{ color: "var(--ink-hint)" }}>
                Contact search uses this person, not the trust name.
              </span>
            </p>
          ) : record.trustInfo.careOf ? (
            <p style={{ color: "var(--enriched-fg)" }}>
              <span className="font-medium">Trust contact (C/O):</span>{" "}
              {titleCase(record.trustInfo.careOf)}
            </p>
          ) : record.trustInfo.entityTrustee ? (
            <p style={{ color: "var(--enriched-fg)" }}>
              <span className="font-medium">Entity trustee:</span>{" "}
              {record.trustInfo.entityTrustee}
              <span className="block text-[11px]" style={{ color: "var(--ink-hint)" }}>
                Held by an entity — individual not in the public record.
              </span>
            </p>
          ) : (
            <p style={{ color: "var(--ink-muted)" }}>
              Trust-held; no individual trustee in the public record.
            </p>
          )}
        </div>
      )}

      <div
        className="mt-3.5 border-t pt-2"
        style={{ borderColor: "var(--border)" }}
      >
        <Row label="Folio" value={record.folio} />
        <Row label="Site" value={record.siteAddress || "—"} />
        <Row label="Mailing" value={mailingStr} />
        {record.assessedValue != null && (
          <Row
            label={`Assessed${record.rollYear ? ` (${record.rollYear})` : ""}`}
            value={currency.format(record.assessedValue)}
          />
        )}
      </div>
    </div>
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDor\b/i, "DOR");
}
