import { createContext, useContext } from 'react';

/**
 * Names for the widgets' icon-only buttons, which a screen reader (and a
 * test) would otherwise meet as nameless "button"s. Provided by the
 * multifilter from its `labels`.
 */
export interface WidgetLabels {
  /** "Quitar filtro" → "Quitar filtro: Estado". */
  removeFilter: string;
  /** "Quitar" → "Quitar Completada". */
  removeValue: string;
}

export const WidgetLabelsContext = createContext<WidgetLabels>({
  removeFilter: 'Quitar filtro',
  removeValue: 'Quitar',
});

export const useWidgetLabels = () => useContext(WidgetLabelsContext);
