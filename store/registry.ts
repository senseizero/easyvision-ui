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
    const existing = get().slices[fullId] as SliceFor<K> | undefined;
    if (existing) return existing;
    const created = init();
    set((s) => ({ slices: { ...s.slices, [fullId]: created } }));
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
