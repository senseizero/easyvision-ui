import type { ReactNode } from "react";
import type { Tone } from "./tone";

// Geometry of the 40x24 speedometer: four segments of the same arc.
const SEGMENTS = [
  [
    "M4.00 22.00 A16 16 0 0 1 8.69 10.69 L12.65 14.65 A10.4 10.4 0 0 0 9.60 22.00 Z",
    "var(--ev-gauge-1, #16a34a)",
  ],
  [
    "M8.69 10.69 A16 16 0 0 1 20.00 6.00 L20.00 11.60 A10.4 10.4 0 0 0 12.65 14.65 Z",
    "var(--ev-gauge-2, #EAB308)",
  ],
  [
    "M20.00 6.00 A16 16 0 0 1 31.31 10.69 L27.35 14.65 A10.4 10.4 0 0 0 20.00 11.60 Z",
    "var(--ev-gauge-3, #dc2626)",
  ],
  [
    "M31.31 10.69 A16 16 0 0 1 36.00 22.00 L30.40 22.00 A10.4 10.4 0 0 0 27.35 14.65 Z",
    "var(--ev-gauge-4, #991b1b)",
  ],
] as const;
const NEEDLE_LENGTH = 13.6;

export interface EasyVisionGaugeProps {
  value: number | null | undefined;
  label?: ReactNode;
  tone?: Tone;
  title?: string;
  size?: number;
}

export function EasyVisionGauge({
  value,
  label,
  tone = "neutral",
  title,
  size = 40,
}: EasyVisionGaugeProps) {
  const valid = typeof value === "number" && Number.isFinite(value);
  const angle = valid ? Math.PI * (1 - Math.min(1, Math.max(0, value))) : 0;
  const x2 = (20 + NEEDLE_LENGTH * Math.cos(angle)).toFixed(2);
  const y2 = (22 - NEEDLE_LENGTH * Math.sin(angle)).toFixed(2);
  return (
    <span className="ev-gauge" data-tone={tone} title={title}>
      <svg
        className="ev-gauge-svg"
        width={size}
        height={Number((size * 0.6).toFixed(2))}
        viewBox="0 0 40 24"
        aria-hidden="true"
      >
        {SEGMENTS.map(([d, fill]) => (
          <path key={fill} d={d} fill={fill} opacity={0.85} />
        ))}
        {valid && (
          <>
            <line
              x1={20}
              y1={22}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <circle cx={20} cy={22} r={2} fill="currentColor" />
          </>
        )}
      </svg>
      <span className="ev-gauge-label">{label ?? "–"}</span>
    </span>
  );
}
