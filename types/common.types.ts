export interface BaseStatefulProps<S = unknown> {
  /** Stable identifier supplied by the user. Internal slice key derived as `${id}-${kind}`. */
  id: string;
  /** Persist value across mount cycles. Default: false → cleared on unmount. */
  persist?: boolean;
  /** When this returns true, the slice is dropped and re-initialized. */
  clearWhen?: (snapshot: S) => boolean;
  /** Notified on every state change. */
  onStateChange?: (snapshot: S) => void;
}

export interface SelectorOption<V extends string | number = string | number> {
  value: V;
  label: string;
}
