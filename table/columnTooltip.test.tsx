// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EasyVisionTable } from './EasyVisionTable';
import { EasyVisionHint } from '../display/EasyVisionHint';
import { easyVisionRegistry } from '../store/registry';
import type { EasyVisionColumn } from '../types/table.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; title: string; summary: string };
const ROWS: Row[] = [{ id: '1', title: 'A very long title', summary: 'Short' }];

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
  act(() => root.render(<EasyVisionTable<Row> id="tt" data={ROWS} columns={columns} />));
const inner = () => [...document.querySelectorAll('.ev-table-cell-truncate-inner')];

describe('column tooltip', () => {
  it('puts tooltip(row) on the truncating wrapper', () => {
    draw([{ field: 'title', header: 'T', truncate: true, tooltip: (r) => `Full: ${r.title}` }]);
    expect(inner()[0].textContent).toBe('A very long title');
    expect(inner()[0].getAttribute('aria-description')).toBe('Full: A very long title');
  });
  it('without tooltip, a non-string cell value has no title', () => {
    draw([{ field: 'title', header: 'T', truncate: true, cell: (r) => <b>{r.title}</b>, type: 'ui' }]);
    expect(inner()[0].hasAttribute('title')).toBe(false);
  });
  it('a tooltip returning undefined leaves no title', () => {
    draw([
      { field: 'title', header: 'T', truncate: true, cell: (r) => <b>{r.title}</b>, tooltip: () => undefined },
    ]);
    expect(inner()[0].hasAttribute('title')).toBe(false);
  });
});

describe('column tooltip as a styled tooltip', () => {
  it('shows the full text on focus and drops the native title', async () => {
    draw([{ field: 'title', header: 'T', truncate: true, tooltip: (r) => `Full: ${r.title}` }]);
    expect(inner()[0].hasAttribute('title')).toBe(false);
    expect(inner()[0].textContent).toBe('A very long title');
    act(() => (inner()[0] as HTMLElement).focus());
    await act(() => new Promise<void>((r) => setTimeout(r, 50)));
    expect(document.querySelector('.ev-tooltip-content')?.textContent).toBe('Full: A very long title');
  });
});

describe('column tooltip and focus', () => {
  const popups = () => [...document.querySelectorAll('.ev-tooltip-content')].map((n) => n.textContent);
  const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

  it('a plain cell is one tab stop and describes itself', () => {
    draw([{ field: 'title', header: 'T', truncate: true, tooltip: (r) => `Full: ${r.title}` }]);
    expect(inner()[0].getAttribute('tabindex')).toBe('0');
    expect(inner()[0].getAttribute('aria-description')).toBe('Full: A very long title');
  });

  it('a cell with its own link adds no tab stop and no description; the link focus opens the tooltip', async () => {
    draw([
      {
        field: 'title',
        header: 'T',
        truncate: true,
        type: 'ui',
        cell: (r) => <a href="#x">{r.title}</a>,
        tooltip: (r) => `Full: ${r.title}`,
      },
    ]);
    expect(inner()[0].hasAttribute('tabindex')).toBe(false);
    expect(inner()[0].hasAttribute('aria-description')).toBe(false);
    act(() => (document.querySelector('.ev-table-cell-truncate-inner a') as HTMLElement).focus());
    await wait(50);
    expect(popups()).toEqual(['Full: A very long title']);
  });

  it('focusing a hint inside the cell opens the hint alone', async () => {
    draw([
      {
        field: 'title',
        header: 'T',
        truncate: true,
        type: 'ui',
        cell: (r) => (
          <span>
            {r.title}
            <EasyVisionHint label="Summary">The summary</EasyVisionHint>
          </span>
        ),
        tooltip: (r) => `Full: ${r.title}`,
      },
    ]);
    act(() => (document.querySelector('button.ev-hint') as HTMLElement).focus());
    await wait(400);
    expect(popups()).toEqual(['The summary']);
  });

  it('moving the pointer from the cell onto its hint swaps the popups', async () => {
    draw([
      {
        field: 'title',
        header: 'T',
        truncate: true,
        type: 'ui',
        cell: (r) => (
          <span>
            {r.title}
            <EasyVisionHint label="Summary">The summary</EasyVisionHint>
          </span>
        ),
        tooltip: (r) => `Full: ${r.title}`,
      },
    ]);
    const fire = (el: Element, types: string[]) =>
      act(() => {
        for (const type of types)
          el.dispatchEvent(new MouseEvent(type, { bubbles: !type.endsWith('enter') }));
      });
    fire(inner()[0], ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']);
    await wait(450);
    expect(popups()).toEqual(['Full: A very long title']);
    const hint = document.querySelector('button.ev-hint')!;
    fire(hint, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']);
    await wait(450);
    expect(popups()).toEqual(['The summary']);
  });
});
