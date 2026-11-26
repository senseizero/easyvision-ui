// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EasyVisionTable } from './EasyVisionTable';
import { EasyVisionScoreCell } from '../display/EasyVisionScoreCell';
import { easyVisionRegistry } from '../store/registry';
import type { EasyVisionColumn } from '../types/table.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; name: string; score: number };
const ROWS: Row[] = [{ id: '1', name: 'A', score: 2 }];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  easyVisionRegistry.setState({ slices: {} } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const draw = (columns: EasyVisionColumn<Row>[]) =>
  act(() => root.render(<EasyVisionTable<Row> id="al" data={ROWS} columns={columns} />));

describe('column align', () => {
  it("'center' puts the class on the th and the td", () => {
    draw([
      { field: 'name', header: 'N' },
      { field: 'score', header: 'S', align: 'center' },
    ]);
    expect(document.querySelector('th[data-field="score"]')!.classList.contains('ev-align-center')).toBe(true);
    expect(document.querySelectorAll('tbody td')[1].classList.contains('ev-align-center')).toBe(true);
    expect(document.querySelector('th[data-field="name"]')!.className).not.toContain('ev-align');
    expect(document.querySelectorAll('tbody td')[0].className).not.toContain('ev-align');
  });
  it("'right' uses its own class", () => {
    draw([{ field: 'score', header: 'S', align: 'right' }]);
    expect(document.querySelector('th[data-field="score"]')!.classList.contains('ev-align-right')).toBe(true);
    expect(document.querySelector('tbody td')!.classList.contains('ev-align-right')).toBe(true);
  });
  it('unset adds nothing; an explicit left has its own class so it can undo the score centring', () => {
    draw([{ field: 'score', header: 'S' }]);
    expect(document.querySelector('tbody td')!.className).not.toContain('ev-align');
    draw([{ field: 'score', header: 'S', align: 'left' }]);
    expect(document.querySelector('tbody td')!.classList.contains('ev-align-left')).toBe(true);
  });
});

describe('score and gauge cells in a table', () => {
  it('a td holding a score is rendered with the score inside it, and the stylesheet centres such cells', () => {
    draw([{ field: 'score', header: 'S', cell: (r) => <EasyVisionScoreCell value={r.score} bands={[{ min: 0, tone: 'warn' }]} /> }]);
    expect(document.querySelector('tbody td .ev-score')).not.toBeNull();
    const css = readFileSync('display/display.css', 'utf8');
    expect(css).toMatch(/td:has\(\.ev-score\),\s*td:has\(\.ev-gauge\)\s*\{\s*text-align:\s*center;/);
  });
});
