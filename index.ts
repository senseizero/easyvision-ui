import './easyvision.css';
import './table/EasyVisionTable.css';

export { EasyVisionInput } from './input/EasyVisionInput';
export { EasyVisionSelector } from './selector/EasyVisionSelector';
export { EasyVisionMultifilter } from './multifilter/EasyVisionMultifilter';
export {
  EasyVisionCard,
  EasyVisionCardHeader,
  EasyVisionCardTitle,
  EasyVisionCardDescription,
  EasyVisionCardContent,
  EasyVisionCardFooter,
} from './card/EasyVisionCard';
export type { MultifilterHandle } from './multifilter/EasyVisionMultifilter';
export { EasyVisionTable } from './table/EasyVisionTable';
export { easyVisionRegistry, getSlice } from './store/registry';

export type { EasyVisionInputProps } from './types/input.types';
export type { EasyVisionSelectorProps } from './types/selector.types';
export type {
  EasyVisionMultifilterProps,
  MultifilterConfig,
  MultifilterSnapshot,
  MultifilterQuery,
  MultifilterLabels,
  FieldDef,
  TextFieldDef,
  SelectorFieldDef,
  MultiSelectFieldDef,
  DateRangeFieldDef,
  NumberRangeFieldDef,
  MultifilterFieldDef,
  CustomFieldDef,
  DateRangeValue,
  NumberRangeValue,
} from './types/multifilter.types';
export type {
  EasyVisionTableProps,
  EasyVisionColumn,
  TableMode,
  TableLabels,
  ApiFetchParams,
  ApiFetchResult,
  SelectionChange,
} from './types/table.types';
export type { BaseStatefulProps, SelectorOption } from './types/common.types';
export { defaultCell } from './lib/defaultCell';

export { createLoopbackTableFetcher, matchLoopbackWhere } from './adapters/loopback';
export type {
  CreateLoopbackTableFetcherOptions,
  LoopbackFilter,
  LoopbackWhereValue,
  LoopbackCountResponse,
} from './adapters/loopback';
