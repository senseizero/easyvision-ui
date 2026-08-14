import { childFullIdOf } from '../store/namespace';
import type { ExportSource } from '../types/export.types';

/**
 * Export sources live here rather than in `easyVisionRegistry` because they
 * are closures over fetchers, not serializable slice state — putting them in
 * the registry would mean teaching `patch` / `drop` / persistence about values
 * that cannot round-trip. Keys are the same `fullId` the registry uses, so
 * namespace resolution is identical on both sides.
 */
const sources = new Map<string, ExportSource<any>>();

export const registerExportSource = (
  fullId: string,
  source: ExportSource<any>
): void => {
  sources.set(fullId, source);
};

export const unregisterExportSource = (fullId: string): void => {
  sources.delete(fullId);
};

export const getExportSource = (
  fullId: string
): ExportSource<any> | undefined => sources.get(fullId);

/**
 * Namespace-first lookup for a table id passed into the export button. A
 * local id is qualified through the surrounding namespace first, since that
 * is how every mounted `EasyVisionTable` actually registers itself. Only if
 * that misses is `tableId` tried verbatim — preserving the documented
 * fully-qualified-id escape hatch without letting a local id that happens to
 * already end in `-table` (e.g. `orders-table`) skip namespacing and miss
 * its registration silently.
 */
export const resolveExportSource = (
  parentFullId: string | null,
  tableId: string
): ExportSource<any> | undefined =>
  getExportSource(childFullIdOf(parentFullId, tableId, 'table')) ??
  getExportSource(tableId);

/** Test seam. Not exported from the package index. */
export const clearExportSources = (): void => {
  sources.clear();
};
