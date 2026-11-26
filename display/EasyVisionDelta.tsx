import type { Tone } from './tone';

export interface EasyVisionDeltaProps {
  value: number;
  goodWhen?: 'up' | 'down';
  format?: (abs: number) => string;
  title?: string;
  directionLabel?: { up: string; down: string };
}

export function EasyVisionDelta({
  value,
  goodWhen = 'up',
  format = String,
  title,
  directionLabel = { up: 'up', down: 'down' },
}: EasyVisionDeltaProps) {
  const flat = !Number.isFinite(value) || value === 0;
  const up = value > 0;
  const tone: Tone = flat
    ? 'neutral'
    : up === (goodWhen === 'up')
      ? 'positive'
      : 'negative';
  return (
    <span className="ev-delta" data-tone={tone} title={title}>
      {flat ? (
        '–'
      ) : (
        <>
          <span aria-hidden="true">{up ? '▲' : '▼'}</span>
          <span className="ev-sr-only">
            {up ? directionLabel.up : directionLabel.down}
          </span>
          {` ${format(Math.abs(value))}`}
        </>
      )}
    </span>
  );
}
