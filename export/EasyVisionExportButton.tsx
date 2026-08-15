import * as React from 'react';
import { useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useParentFullId } from '../store/NamespaceContext';
import { resolveExportSource } from './sources';
import { exportSheets } from './buildWorkbook';
import type {
  EasyVisionExportButtonProps,
  ExportLabels,
  ExportSource,
  SheetSpec,
} from '../types/export.types';

const DEFAULT_LABELS: ExportLabels = {
  export: 'Exportar',
  exporting: 'Exportando...',
};

export function EasyVisionExportButton({
  tables,
  filename,
  sheetNames,
  labels: labelOverrides,
  onError,
  onEmpty,
  disabled = false,
  className,
  icon,
}: EasyVisionExportButtonProps) {
  const labels: ExportLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const parentFullId = useParentFullId();
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = useCallback(async () => {
    setIsExporting(true);
    try {
      // Resolve every id up front (synchronous) so a partial resolution
      // failure can be reported before any row is fetched. When every id
      // fails to resolve, this falls through to the existing empty-sheets
      // path below (`onEmpty`) rather than erroring — the source registry
      // is a plain, non-reactive `Map`, so a button rendering before its
      // tables mount relies on that fallback rather than disabling itself.
      const resolved: { tableId: string; source: ExportSource<unknown> | undefined }[] =
        tables.map((tableId) => ({
          tableId,
          source: resolveExportSource(parentFullId, tableId),
        }));
      const unresolved = resolved
        .filter((r) => !r.source)
        .map((r) => r.tableId);
      if (unresolved.length > 0 && unresolved.length < tables.length) {
        onError?.(
          new Error(
            `EasyVisionExportButton: could not resolve table id(s): ${unresolved.join(', ')}`
          )
        );
        return;
      }

      const sheets: SheetSpec[] = [];
      // Sequential on purpose: each source may page through a large result
      // set, and running those loops concurrently invites rate-limiting.
      for (const { tableId, source } of resolved) {
        if (!source) continue;
        const columns = source.getColumns();
        // buildWorkbook discards any sheet with zero columns anyway — check
        // here first so a table with no visible columns doesn't still pay
        // for paginating through its entire (API-backed) result set.
        if (columns.length === 0) continue;
        sheets.push({
          name: sheetNames?.[tableId] ?? source.sheetName,
          columns,
          rows: await source.getRows(),
        });
      }

      const written = await exportSheets(sheets, { filename });
      if (!written) onEmpty?.();
    } catch (error) {
      // Abort whole rather than ship a workbook silently missing a sheet.
      onError?.(error);
    } finally {
      setIsExporting(false);
    }
  }, [tables, parentFullId, sheetNames, filename, onEmpty, onError]);

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled || isExporting}
      onClick={handleClick}
    >
      {isExporting ? (
        <Loader2 className="ev-export-icon animate-spin" />
      ) : (
        icon ?? <Download className="ev-export-icon" />
      )}
      {isExporting ? labels.exporting : labels.export}
    </Button>
  );
}
