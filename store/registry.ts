import { createStore } from 'zustand/vanilla';
import type { Slice, SliceKind, SliceFor } from './slice-types';

export interface RegistryState {
  slices: Record<string, Slice>;
  ensure: <K extends SliceKind>(
    kind: K,
    fullId: string,
    init: () => SliceFor<K>
  ) => SliceFor<K>;
  patch: <K extends SliceKind>(
    fullId: string,
    partial: Partial<SliceFor<K>>
  ) => void;
  drop: (fullId: string) => void;
  reset: () => void;
}

export const easyVisionRegistry = createStore<RegistryState>((set, get) => ({
  slices: {},

  ensure: <K extends SliceKind>(
    _kind: K,
    fullId: string,
    init: () => SliceFor<K>
  ) => {
    const state = get();
    const existing = state.slices[fullId] as SliceFor<K> | undefined;
    if (existing) return existing;
    const created = init();
    // Initialize the slice in place without going through `set`. `ensure` is
    // commonly called during a consumer's render (e.g. inside
    // `useEasyVisionSlice`), where invoking `set` would synchronously notify
    // every subscriber — including other `useSyncExternalStore`-driven
    // components currently rendering — and trip React's "Cannot update a
    // component while rendering a different component" warning.
    //
    // Mutating the slices map in place is safe because no subscriber was
    // observing this key a moment ago: the slice did not exist, so any
    // snapshot they returned was `undefined`. The next render of the owning
    // component will pick up the new slice via the snapshot getter; for any
    // unrelated subscriber, the outer state reference is unchanged so their
    // snapshot identity is stable and they don't re-render.
    (state.slices as Record<string, Slice>)[fullId] = created;
    return created;
  },

  patch: <K extends SliceKind>(fullId: string, partial: Partial<SliceFor<K>>) => {
    set((s) => {
      const current = s.slices[fullId];
      if (!current) return s;
      return {
        slices: {
          ...s.slices,
          [fullId]: { ...current, ...partial } as Slice,
        },
      };
    });
  },

  drop: (fullId: string) => {
    set((s) => {
      const next: Record<string, Slice> = {};
      const prefix = `${fullId}.`;
      for (const key of Object.keys(s.slices)) {
        if (key !== fullId && !key.startsWith(prefix)) {
          next[key] = s.slices[key];
        }
      }
      return { slices: next };
    });
  },

  reset: () => set({ slices: {} }),
}));

export const getSlice = <K extends SliceKind>(
  fullId: string
): SliceFor<K> | undefined =>
  easyVisionRegistry.getState().slices[fullId] as SliceFor<K> | undefined;
