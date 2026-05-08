import { getByPath } from './isNestedAccessor';

const numericRe = /-?\d+(?:[.,]\d+)?/;

function extractFirstNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const match = value.match(numericRe);
    if (match) {
      const parsed = parseFloat(match[0].replace(',', '.'));
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  return null;
}

export function compareByPath(a: unknown, b: unknown, path: string, descending: boolean): number {
  const av = getByPath(a, path);
  const bv = getByPath(b, path);

  if (av == null && bv == null) return 0;
  if (av == null) return descending ? 1 : -1;
  if (bv == null) return descending ? -1 : 1;

  // Numeric comparison takes priority when both values yield a number, even from
  // mixed strings like "Plan 12" — matches bench-vision Table.tsx 174-182.
  const an = extractFirstNumber(av);
  const bn = extractFirstNumber(bv);
  if (an !== null && bn !== null) {
    return descending ? bn - an : an - bn;
  }

  if (av instanceof Date && bv instanceof Date) {
    return descending ? bv.getTime() - av.getTime() : av.getTime() - bv.getTime();
  }

  const as = String(av);
  const bs = String(bv);
  return descending ? bs.localeCompare(as) : as.localeCompare(bs);
}
