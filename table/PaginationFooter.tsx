import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
}

export function PaginationFooter({
  currentPage,
  totalCount,
  itemsPerPage,
  itemsPerPageOptions,
  onPageChange,
  onItemsPerPageChange,
  labels,
}: PaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  return (
    <div className="flex items-center justify-between p-4 border-t border-border text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{labels.rowsPerPage}</span>
        <Select
          value={String(itemsPerPage)}
          onValueChange={(v) => onItemsPerPageChange(Number(v))}
        >
          <SelectTrigger className="h-9 w-[70px] border border-border">
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
        <span>
          {totalCount} {labels.results}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span>{labels.page}</span>
        <Select
          value={String(currentPage)}
          onValueChange={(v) => onPageChange(Number(v))}
        >
          <SelectTrigger className="h-9 w-16 border border-border">
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
        <div className="flex items-center gap-1 ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
