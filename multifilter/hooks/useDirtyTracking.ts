import { stableStringify } from '../../lib/stableStringify';

export function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('from' in obj || 'to' in obj) {
      return obj.from !== undefined || obj.to !== undefined;
    }
    if ('min' in obj || 'max' in obj) {
      return obj.min !== undefined || obj.max !== undefined;
    }
    return Object.values(obj).some(isNonEmpty);
  }
  return true;
}

export interface DirtySnapshotInput {
  activeFields: string[];
  values: Record<string, unknown>;
}

export function buildSnapshotKey(input: DirtySnapshotInput): string {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(input.values)) {
    if (isNonEmpty(input.values[key])) {
      filtered[key] = input.values[key];
    }
  }
  return stableStringify({
    activeFields: [...input.activeFields].sort(),
    values: filtered,
  });
}

export function isDirty(input: DirtySnapshotInput, lastConfirmed: string | null): boolean {
  const current = buildSnapshotKey(input);
  if (lastConfirmed === null) {
    return Object.values(input.values).some(isNonEmpty);
  }
  return current !== lastConfirmed;
}
