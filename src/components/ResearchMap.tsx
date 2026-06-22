"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { ResearchResult } from "@/lib/research";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LMap = any;

export default function ResearchMap({
  results,
  onPick,
}: {
  results: ResearchResult[];
  onPick: (folio: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap>(null);
  const layerRef = useRef<LMap>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current, { scrollWheelZoom: false }).setView(
          [25.6, -80.5],
          9,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const layer = layerRef.current;
      layer.clearLayers();
      const pts: [number, number][] = [];

      for (const r of results) {
        if (r.lat == null || r.lon == null) continue;
        const marker = L.circleMarker([r.lat, r.lon], {
          radius: 6,
          color: "#0f6e56",
          weight: 2,
          fillColor: "#1d9e75",
          fillOpacity: 0.65,
        });
        marker.bindTooltip(
          `${r.owner || "—"} · ${r.acres.toFixed(1)} ac`,
        );
        marker.on("click", () => onPickRef.current(r.folio));
        marker.addTo(layer);
        pts.push([r.lat, r.lon]);
      }

      if (pts.length) {
        mapRef.current.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
      }
      mapRef.current.invalidateSize();
    })();
    return () => {
      cancelled = true;
    };
  }, [results]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={elRef}
      style={{
        height: 380,
        width: "100%",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "0.5px solid var(--border)",
        zIndex: 0,
      }}
    />
  );
}
