import Workspace from "@/components/Workspace";

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
          Miami-Dade County Property Owner Lookup
        </span>
      </header>

      <Workspace />
    </main>
  );
}
