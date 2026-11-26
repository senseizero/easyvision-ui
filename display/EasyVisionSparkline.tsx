import type { Tone } from './tone';

const FALLBACK: Record<Tone, string> = {
  positive: '#16A34A',
  negative: '#DC2626',
  warn: '#CA8A04',
  info: '#2563EB',
  neutral: 'currentColor',
};

export interface EasyVisionSparklineProps {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

export function EasyVisionSparkline({
  values,
  tone,
  width = 84,
  height = 20,
  ariaLabel,
}: EasyVisionSparklineProps) {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  const pts = finite.map((v, i) => {
    const x =
      finite.length === 1
        ? width / 2
        : 1 + (i * (width - 2)) / (finite.length - 1);
    const y =
      span === 0 ? height / 2 : 1 + (height - 2) * (1 - (v - min) / span);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const last = pts[pts.length - 1];
  const t = tone ?? 'neutral';
  const stroke = `var(--ev-${t}, ${FALLBACK[t]})`;
  return (
    <svg
      className="ev-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {pts.length > 0 && (
        <>
          <polyline
            points={pts.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
        </>
      )}
    </svg>
  );
}
