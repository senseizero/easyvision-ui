import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { easyVisionRegistry } from './registry';
import { childFullIdOf } from './namespace';
import { useParentFullId } from './NamespaceContext';
import type { SliceFor, SliceKind } from './slice-types';

export interface UseSliceOptions<K extends SliceKind> {
  init: () => SliceFor<K>;
  persist?: boolean;
  /** When this returns true, the slice is dropped and re-initialized. */
  clearWhen?: (slice: SliceFor<K>) => boolean;
  /** Notified on every store change for this fullId. */
  onStateChange?: (slice: SliceFor<K>) => void;
}

export interface UseSliceReturn<K extends SliceKind> {
  fullId: string;
  slice: SliceFor<K>;
  patch: (partial: Partial<SliceFor<K>>) => void;
  reset: () => void;
}

export function useEasyVisionSlice<K extends SliceKind>(
  kind: K,
  localId: string,
  opts: UseSliceOptions<K>
): UseSliceReturn<K> {
  const parentFullId = useParentFullId();
  const fullId = useMemo(
    () => childFullIdOf(parentFullId, localId, kind),
    [parentFullId, localId, kind]
  );

  // Ensure the slice exists synchronously before any subscriber reads it.
  // We call this on every render in case the slice has been dropped (clearWhen).
  if (!easyVisionRegistry.getState().slices[fullId]) {
    easyVisionRegistry.getState().ensure(kind, fullId, opts.init);
  }

  const slice = useSyncExternalStore(
    easyVisionRegistry.subscribe,
    () => {
      const s = easyVisionRegistry.getState().slices[fullId] as
        | SliceFor<K>
        | undefined;
      if (s) return s;
      // Slice missing (e.g. just dropped); ensure and return.
      return easyVisionRegistry.getState().ensure(kind, fullId, opts.init);
    },
    () => easyVisionRegistry.getState().ensure(kind, fullId, opts.init)
  );

  // clearWhen: drop and re-init.
  useEffect(() => {
    if (opts.clearWhen && opts.clearWhen(slice)) {
      easyVisionRegistry.getState().drop(fullId);
      easyVisionRegistry.getState().ensure(kind, fullId, opts.init);
    }
  }, [slice, fullId, kind, opts]);

  // onStateChange forwarding.
  useEffect(() => {
    opts.onStateChange?.(slice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice]);

  // Cleanup on unmount unless persist.
  useEffect(() => {
    return () => {
      if (!opts.persist) {
        easyVisionRegistry.getState().drop(fullId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullId]);

  const patch = useMemo(
    () => (partial: Partial<SliceFor<K>>) =>
      easyVisionRegistry.getState().patch<K>(fullId, partial),
    [fullId]
  );

  const reset = useMemo(
    () => () => {
      easyVisionRegistry.getState().drop(fullId);
      easyVisionRegistry.getState().ensure(kind, fullId, opts.init);
    },
    [fullId, kind, opts]
  );

  return { fullId, slice, patch, reset };
}
