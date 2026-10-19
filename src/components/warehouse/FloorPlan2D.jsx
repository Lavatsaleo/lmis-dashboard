import React from "react";

import { PALLET } from "./layout";

/**
 * Top-down floor plan of the same layout as the 3D view. Light enough for
 * phones and for browsers without WebGL. Darker = fuller pallet.
 */
export default function FloorPlan2D({ layout, colorFor, isDimmed, selected, onSelect, height = 520 }) {
  const P = layout.pallet || PALLET;
  const { width, depth } = layout.floor;
  const apron = layout.incoming.length ? layout.dock.depth : 2;
  const vb = `${-width / 2} ${-depth / 2} ${width} ${depth + apron}`;

  return (
    <div style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", background: "#F4F7F9" }}>
      <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Warehouse floor plan">
        <rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="#E7EBEE" stroke="#94A3B8" strokeWidth={0.15} />
        <line x1={-width / 2} x2={width / 2} y1={depth / 2 - 0.15} y2={depth / 2 - 0.15} stroke="#F2B705" strokeWidth={0.18} />
        {layout.slots.map((s) => (
          <rect
            key={`s${s.row}-${s.col}`}
            x={s.x - P.w / 2}
            y={s.z - P.d / 2}
            width={P.w}
            height={P.d}
            fill="none"
            stroke="#CBD5DC"
            strokeWidth={0.06}
          />
        ))}
        {layout.pallets.map((p) => {
          const isSel = selected?.id === p.id;
          return (
            <rect
              key={p.id}
              x={p.x - P.w / 2}
              y={p.z - P.d / 2}
              width={P.w}
              height={P.d}
              rx={0.08}
              fill={colorFor(p)}
              fillOpacity={isDimmed(p) ? 0.15 : 0.35 + 0.65 * p.fill}
              strokeDasharray={p.held ? "0.15 0.1" : undefined}
              stroke={isSel ? "#0F172A" : p.held ? "#7C3AED" : "none"}
              strokeWidth={isSel ? 0.14 : p.held ? 0.1 : 0}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(isSel ? null : p)}
            >
              <title>{`${p.batch.productName} · batch ${p.batch.batchNo} · ${p.boxes} boxes · expires ${new Date(p.batch.expiryDate).toLocaleDateString()}`}</title>
            </rect>
          );
        })}
        {layout.incoming.map((g) => (
          <rect
            key={g.id}
            x={g.x - P.w / 2}
            y={g.z - P.d / 2}
            width={P.w}
            height={P.d}
            rx={0.08}
            fill="#3B82F6"
            fillOpacity={0.25}
            stroke="#3B82F6"
            strokeDasharray="0.15 0.1"
            strokeWidth={0.06}
          >
            <title>{`Incoming · ${g.shipment.manifestNo} · ${g.shipment.boxes} boxes`}</title>
          </rect>
        ))}
        <text x={0} y={depth / 2 + Math.max(1.2, width / 24)} textAnchor="middle" fontSize={Math.max(0.8, width / 36)} fill="#7A5B00" fontWeight={600}>
          DISPATCH DOCK
        </text>
      </svg>
    </div>
  );
}
