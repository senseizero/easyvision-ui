export type SliceKind = 'input' | 'selector' | 'multifilter' | 'table';

export const KIND_SUFFIX: Record<SliceKind, string> = {
  input: '-input',
  selector: '-selector',
  multifilter: '-multifilter',
  table: '-table',
};

export interface InputSliceData {
  kind: 'input';
  value: string;
}

export interface SelectorSliceData {
  kind: 'selector';
  value: string | number | undefined;
}

export interface MultifilterSliceData {
  kind: 'multifilter';
  activeFields: string[];
  values: Record<string, unknown>;
  lastConfirmedSnapshotJSON: string | null;
}

export interface TableSelection {
  ids: Record<string, true>;
  scope: 'page' | 'all';
  exceptIds?: Record<string, true>;
}

export interface TableSliceData {
  kind: 'table';
  page: number;
  itemsPerPage: number;
  sort: { column: string; descending: boolean } | null;
  selection: TableSelection;
  // User-toggled column visibility. Keys absent here fall back to the column's
  // `initiallyHidden` default at read time, so columns added after persistence
  // still honor their declared default.
  columnVisibility: Record<string, boolean>;
  // Drag-resized widths in pixels, keyed by column id. Only populated for
  // columns marked `resizable: true`; non-resizable columns ignore this map.
  columnSizing: Record<string, number>;
}

export type Slice =
  | InputSliceData
  | SelectorSliceData
  | MultifilterSliceData
  | TableSliceData;

export type SliceFor<K extends SliceKind> = Extract<Slice, { kind: K }>;
