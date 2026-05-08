import type { BaseStatefulProps } from './common.types';

export interface EasyVisionInputProps extends BaseStatefulProps<string> {
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
