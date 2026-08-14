import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExportSources,
  getExportSource,
  registerExportSource,
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
