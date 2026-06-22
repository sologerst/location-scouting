"use client";

import { useCallback, useRef, useState } from "react";
import type { QueryType } from "@/lib/types";
import SearchExperience, { type SearchTrigger } from "./SearchExperience";
import HistoryPanel from "./HistoryPanel";
import ResearchPanel from "./ResearchPanel";

type Tab = "search" | "research" | "history";

export default function Workspace() {
  const [tab, setTab] = useState<Tab>("search");
  const [trigger, setTrigger] = useState<SearchTrigger | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const nonce = useRef(0);

  const pick = useCallback((query: string, type: QueryType) => {
    nonce.current += 1;
    setTrigger({ q: query, type, nonce: nonce.current });
    setTab("search");
  }, []);

  const openHistory = () => {
    setHistoryRefresh((n) => n + 1);
    setTab("history");
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections"
        className="mb-6 flex gap-1 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <TabButton active={tab === "search"} onClick={() => setTab("search")} icon="search">
          Search
        </TabButton>
        <TabButton active={tab === "research"} onClick={() => setTab("research")} icon="research">
          Research
        </TabButton>
        <TabButton active={tab === "history"} onClick={openHistory} icon="clock">
          History
        </TabButton>
      </div>

      <div hidden={tab !== "search"}>
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
        <SearchExperience trigger={trigger} />
      </div>

      <div hidden={tab !== "research"}>
        <ResearchPanel onPick={pick} />
      </div>

      <div hidden={tab !== "history"}>
        <HistoryPanel refreshKey={historyRefresh} onPick={pick} />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: "search" | "clock" | "research";
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] font-medium transition-colors"
      style={{
        borderColor: active ? "var(--brand)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-hint)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        {icon === "search" && (
          <>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {icon === "research" && (
          <path
            d="M3 5h18M6 12h12M10 19h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {icon === "clock" && (
          <>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
      {children}
    </button>
  );
}
