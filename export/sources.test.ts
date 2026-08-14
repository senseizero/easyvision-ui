import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExportSources,
  getExportSource,
  registerExportSource,
  resolveExportSource,
  unregisterExportSource,
} from './sources';
import type { ExportSource } from '../types/export.types';

const sourceNamed = (sheetName: string): ExportSource => ({
  sheetName,
  getColumns: () => [],
  getRows: async () => [],
});

describe('export source registry', () => {
  beforeEach(() => clearExportSources());

  it('returns undefined for an unknown id', () => {
    expect(getExportSource('nope-table')).toBeUndefined();
  });

  it('round-trips a registered source by fullId', () => {
    const source = sourceNamed('Alertas');
    registerExportSource('alerts-table', source);
    expect(getExportSource('alerts-table')).toBe(source);
  });

  it('keeps namespaced ids distinct', () => {
    registerExportSource('page-table.alerts-table', sourceNamed('A'));
    registerExportSource('alerts-table', sourceNamed('B'));
    expect(getExportSource('page-table.alerts-table')!.sheetName).toBe('A');
    expect(getExportSource('alerts-table')!.sheetName).toBe('B');
  });

  it('replaces a source registered twice under the same id', () => {
    registerExportSource('alerts-table', sourceNamed('Vieja'));
    registerExportSource('alerts-table', sourceNamed('Nueva'));
    expect(getExportSource('alerts-table')!.sheetName).toBe('Nueva');
  });

  it('forgets a source after unregister', () => {
    registerExportSource('alerts-table', sourceNamed('Alertas'));
    unregisterExportSource('alerts-table');
    expect(getExportSource('alerts-table')).toBeUndefined();
  });

  it('tolerates unregistering an id that was never registered', () => {
    expect(() => unregisterExportSource('ghost-table')).not.toThrow();
  });
});

describe('resolveExportSource', () => {
  beforeEach(() => clearExportSources());

  it('resolves a bare local id via its namespaced registration', () => {
    registerExportSource('orders-table', sourceNamed('Orders'));
    expect(resolveExportSource(null, 'orders')?.sheetName).toBe('Orders');
  });

  it('resolves a local id that itself ends in -table', () => {
    // Regression: `orders-table` registers under `orders-table-table`
    // (childFullIdOf appends the suffix mechanically), so looking it up must
    // not treat the local id as already fully-qualified.
    registerExportSource('orders-table-table', sourceNamed('Orders'));
    expect(resolveExportSource(null, 'orders-table')?.sheetName).toBe('Orders');
  });

  it('falls back to a fully-qualified id verbatim', () => {
    registerExportSource('page-table.alerts-table', sourceNamed('Alertas'));
    expect(
      resolveExportSource(null, 'page-table.alerts-table')?.sheetName
    ).toBe('Alertas');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveExportSource(null, 'ghost')).toBeUndefined();
  });

  it('resolves a local id inside a namespace', () => {
    registerExportSource('page-table.orders-table', sourceNamed('Orders'));
    expect(resolveExportSource('page-table', 'orders')?.sheetName).toBe('Orders');
  });
});
