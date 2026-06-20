import SearchExperience from "@/components/SearchExperience";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-8 flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        <span className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
          Location Scouting
        </span>
      </header>

      <h1
        className="mb-2 text-2xl font-medium tracking-tight sm:text-3xl"
        style={{ color: "var(--ink)" }}
      >
        Find the owner of any Miami-Dade property
      </h1>
      <p className="mb-7 text-[15px]" style={{ color: "var(--ink-muted)" }}>
        Enter a street address or 13-digit folio number. We return the owner of
        record from the county, then look up a way to reach them.
      </p>

      <SearchExperience />
    </main>
  );
}
