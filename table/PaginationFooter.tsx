import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TableLabels } from '../types/table.types';

export interface PaginationFooterProps {
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
  labels: Pick<TableLabels, 'rowsPerPage' | 'results' | 'page' | 'of'>;
  /**
   * Footer display mode. Mirrors `EasyVisionTableProps.paginationDisplay`.
   * `'fixedTotalItems'` is handled by the parent (footer not rendered) so
   * this component only needs to distinguish `'always'` from
   * `'fixedItemsPerPage'`.
   */
  display?: 'always' | 'fixedItemsPerPage';
}

export function PaginationFooter({
  currentPage,
  totalCount,
  itemsPerPage,
  itemsPerPageOptions,
  onPageChange,
  onItemsPerPageChange,
  labels,
  display = 'always',
}: PaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const fitsInOnePage = totalCount <= itemsPerPage;
  // In fixedItemsPerPage mode, the rows-per-page selector is hidden and page
  // navigation only appears when the dataset spills past one page.
  const showRowsPerPage = display === 'always';
  const showPageNav = display === 'always' || !fitsInOnePage;

  return (
    <div className="ev-table-footer">
      <div className="ev-table-footer-section">
        {showRowsPerPage && (
          <>
            <span>{labels.rowsPerPage}</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => onItemsPerPageChange(Number(v))}
            >
              <SelectTrigger className="ev-table-footer-ipp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemsPerPageOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <span>
          {totalCount} {labels.results}
        </span>
      </div>

      {showPageNav && (
        <div className="ev-table-footer-section">
          <span>{labels.page}</span>
          <Select
            value={String(currentPage)}
            onValueChange={(v) => onPageChange(Number(v))}
          >
            <SelectTrigger className="ev-table-footer-pg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            {labels.of} {totalPages}
          </span>
          <div className="ev-table-footer-nav">
            <Button
              variant="ghost"
              size="icon"
              className="ev-table-footer-nav-btn"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft className="ev-table-footer-nav-icon" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ev-table-footer-nav-btn"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight className="ev-table-footer-nav-icon" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
