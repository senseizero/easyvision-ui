import { format as formatDate, isValid, parseISO } from "date-fns";

export interface EasyVisionDateChipProps {
  date: Date | string | null | undefined;
  now?: Date;
  steps?: { solid: number; light: number; grey: number };
  format?: (d: Date) => string;
  title?: string;
}

const DAY = 86_400_000;
const DEFAULT_STEPS = { solid: DAY, light: 7 * DAY, grey: 30 * DAY };

export function EasyVisionDateChip({
  date,
  now,
  steps = DEFAULT_STEPS,
  format = (d) => formatDate(d, "dd/MM/yy"),
  title,
}: EasyVisionDateChipProps) {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!parsed || !isValid(parsed)) {
    return (
      <span className="ev-date-chip" title={title}>
        –
      </span>
    );
  }
  const age = (now ?? new Date()).getTime() - parsed.getTime();
  const step =
    age < steps.solid
      ? "solid"
      : age <= steps.light
        ? "light"
        : age <= steps.grey
          ? "grey"
          : "outline";
  return (
    <span className="ev-date-chip" data-step={step} title={title}>
      {format(parsed)}
    </span>
  );
}
