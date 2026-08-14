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
      const sheets: SheetSpec[] = [];
      // Sequential on purpose: each source may page through a large result
      // set, and running those loops concurrently invites rate-limiting.
      for (const tableId of tables) {
        const source = resolveExportSource(parentFullId, tableId);
        if (!source) continue;
        sheets.push({
          name: sheetNames?.[tableId] ?? source.sheetName,
          columns: source.getColumns(),
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
