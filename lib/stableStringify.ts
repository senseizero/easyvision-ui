/**
 * Deterministic JSON serialization. Keys are sorted at every level so that
 * { a: 1, b: 2 } and { b: 2, a: 1 } produce identical strings. Dates are
 * coerced to ISO strings; undefined values are dropped.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const norm = normalize(obj[key]);
      if (norm !== undefined) out[key] = norm;
    }
    return out;
  }
  return value;
}
