import type { BaseStatefulProps } from './common.types';

import type { InputHTMLAttributes } from 'react';

export interface EasyVisionInputProps extends BaseStatefulProps<string> {
  /**
   * Controlled: the input shows this and reports every keystroke through
   * `onChange` at once (no debounce, no registry state) — what a form that
   * sets its values from outside needs. Omit it for the self-managed input.
   */
  value?: string;
  /**
   * Passed to the native `<input>`: `id` (for a `<label htmlFor>`), `type`,
   * `name`, `required`, `autoComplete`, `aria-*`, `onKeyDown`, `onBlur`…
   */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange' | 'disabled' | 'placeholder'
  >;
  label?: string;
  placeholder?: string;
  /** Auto-fire onChange after Nms of inactivity. Default 300. */
  debounceMs?: number;
  mandatory?: boolean;
  defaultValue?: string;
  onChange?: (value: string) => void;
  icon?: 'search' | 'none';
  showClearButton?: boolean;
  className?: string;
  disabled?: boolean;
}
