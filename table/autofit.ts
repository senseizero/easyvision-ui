/**
 * Which columns fit (`columnFit: 'hide'`): instead of scrolling sideways, a
 * table that runs out of width hides columns by priority and brings them back
 * as it widens. Ported from nml-vision v3's data-table.
 *
 * Pure: it decides from widths already measured; measuring (DOM, observer,
 * the cache of maxima) lives in EasyVisionTable. Essentials always go in; the
 * rest go in by priority while they fit. Hysteresis is per candidate: bringing
 * a hidden column back costs its width + `margin`, or hide/show would flicker
 * with every pixel the observer reports.
 */

export interface FitCandidate {
  id: string;
  /** Widest seen, in px. Not measured yet: 0 (it enters and gets measured). */
  width: number;
  /** Higher stays longer. Ties: the one further left. */
  priority: number;
  /** Always shown: the first column, the selection, the row's actions. */
  essential: boolean;
  /** Hidden right now: pays `margin` to come back (hysteresis). */
  hidden: boolean;
}

export function fitColumns(
  candidates: FitCandidate[],
  containerWidth: number,
  margin = 24
): Set<string> {
  const visible = new Set<string>();
  let used = 0;

  for (const candidate of candidates) {
    if (!candidate.essential) continue;
    visible.add(candidate.id);
    used += candidate.width;
  }

  const rest = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !candidate.essential)
    .sort((a, b) => b.candidate.priority - a.candidate.priority || a.index - b.index);

  for (const { candidate } of rest) {
    const cost = candidate.width + (candidate.hidden ? margin : 0);
    if (used + cost > containerWidth) continue;
    visible.add(candidate.id);
    used += candidate.width;
  }

  return visible;
}
