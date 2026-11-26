import type { Tone } from './tone';

export interface EasyVisionDeltaProps {
  value: number;
  goodWhen?: 'up' | 'down';
  format?: (abs: number) => string;
  title?: string;
}

export function EasyVisionDelta({
  value,
  goodWhen = 'up',
  format = String,
  title,
}: EasyVisionDeltaProps) {
  const up = value > 0;
  const tone: Tone =
    value === 0 ? 'neutral' : up === (goodWhen === 'up') ? 'positive' : 'negative';
  return (
    <span className="ev-delta" data-tone={tone} title={title}>
      {value === 0 ? '–' : `${up ? '▲' : '▼'} ${format(Math.abs(value))}`}
    </span>
  );
}
