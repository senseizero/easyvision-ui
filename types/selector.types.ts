import type { BaseStatefulProps, SelectorOption } from './common.types';

export interface EasyVisionSelectorProps<V extends string | number = string | number>
  extends BaseStatefulProps<V | undefined> {
  /**
   * Controlled: shows this and reports a pick through `onChange` (no registry
   * state). `null` is «nothing picked» while controlled; omit the prop for
   * the self-managed selector.
   */
  value?: V | null;
  /** On the trigger: `id` (for a `<label htmlFor>`) and `aria-*`. */
  triggerProps?: {
    id?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  };
  label?: string;
  options: SelectorOption<V>[] | (() => Promise<SelectorOption<V>[]>);
  placeholder?: string;
  mandatory?: boolean;
  defaultValue?: V;
  /** Confirm-mode parity with bench-vision SimpleSelector — value isn't committed until Confirm. */
  confirmMode?: boolean;
  confirmLabel?: string;
  /** The clear button's name (shown when not `mandatory`). Default 'Limpiar'. */
  clearLabel?: string;
  searchable?: boolean;
  onChange?: (value: V | undefined) => void;
  className?: string;
  disabled?: boolean;
}
