import type { Tone } from './tone';

export interface EasyVisionScoreCellProps {
  value: number | null | undefined;
  bands?: { min: number; tone: Tone }[];
  format?: (v: number) => string;
}

const defaultFormat = (v: number) => `${(v * 100).toFixed(1)} %`;

export function EasyVisionScoreCell({
  value,
  bands,
  format = defaultFormat,
}: EasyVisionScoreCellProps) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="ev-score">–</div>;
  }
  const tone = bands
    ? [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min)?.tone
    : undefined;
  return (
    <div className="ev-score" data-tone={tone}>
      {tone && <span className="ev-score-dot" />}
      <span>{format(value)}</span>
    </div>
  );
}
