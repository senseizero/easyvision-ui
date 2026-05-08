import * as React from 'react';
import type { ReactNode } from 'react';

/**
 * Wraps content in the standard EasyVision table cell span.
 * Use inside `cell` when you need custom content but want consistent base styling.
 *
 * Pass `title` when the cell is used in a `truncate: true` column so hover
 * still reveals the full text (the table only auto-sets `title` for data
 * columns with a string accessor — for `type: 'ui'` columns or rich content
 * you have to provide it explicitly).
 *
 * @example
 * cell: ({ row }) => defaultCell(<ScoringIndicator score={row.original.scoring} />)
 * cell: ({ row }) => defaultCell(formatDateForRow(row.original.created))
 * cell: (a) => defaultCell(a.title, a.title)  // truncate-friendly
 */
export const defaultCell = (content: ReactNode, title?: string): ReactNode => (
  <span className="text-sm text-foreground" title={title}>
    {content}
  </span>
);
