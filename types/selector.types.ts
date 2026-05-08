import type { BaseStatefulProps, SelectorOption } from './common.types';

export interface EasyVisionSelectorProps<V extends string | number = string | number>
  extends BaseStatefulProps<V | undefined> {
  label?: string;
  options: SelectorOption<V>[] | (() => Promise<SelectorOption<V>[]>);
  placeholder?: string;
  mandatory?: boolean;
  defaultValue?: V;
  /** Confirm-mode parity with bench-vision SimpleSelector — value isn't committed until Confirm. */
  confirmMode?: boolean;
  confirmLabel?: string;
  searchable?: boolean;
  onChange?: (value: V | undefined) => void;
  className?: string;
  disabled?: boolean;
}
