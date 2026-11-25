// @vitest-environment jsdom
/**
 * columnFit: 'hide' against a measured DOM. jsdom measures 0, so this file
 * stubs clientWidth/offsetWidth and a ResizeObserver that fires. Without the
 * stubs nothing is ever hidden — the guard that keeps every other test as is.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyVisionTable } from './EasyVisionTable';
import { easyVisionRegistry } from '../store/registry';
import type { EasyVisionColumn } from '../types/table.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; a: string; b: string; c: string; d: string };
const ROWS: Row[] = [{ id: '1', a: 'Ada', b: 'Bletchley', c: 'Colossus', d: '—' }];
const COLUMNS: EasyVisionColumn<Row>[] = [
  { field: 'a', header: 'Alpha' },
  { field: 'b', header: 'Beta' },
  { field: 'c', header: 'Gamma' },
];

/** Header widths per field and the scroll container's, adjustable per test. */
const widths: Record<string, number> = {};
let fireResize: () => void = () => {};
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(widths, { container: 0, a: 200, b: 150, c: 150, d: 40, _select: 36 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('easyvision-table-scroll') ? widths.container : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const field = this.getAttribute('data-field');
      return field && field in widths ? widths[field] : 0;
    },
  });
  const callbacks: (() => void)[] = [];
  fireResize = () => callbacks.forEach((cb) => cb());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    }
  );
  easyVisionRegistry.setState({ slices: {} } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
  // @ts-expect-error back to jsdom's own (absent) getters
  delete HTMLElement.prototype.clientWidth;
  // @ts-expect-error idem
  delete HTMLElement.prototype.offsetWidth;
  vi.unstubAllGlobals();
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

async function draw(props: Partial<Parameters<typeof EasyVisionTable<Row>>[0]> = {}) {
  act(() =>
    root.render(
      <EasyVisionTable<Row> id="t" data={ROWS} columns={COLUMNS} columnFit="hide" {...props} />
    )
  );
  await flush();
}

const headers = () => [...document.querySelectorAll('th[data-field]')].map((th) => th.getAttribute('data-field'));

async function resize(container: number) {
  widths.container = container;
  act(() => fireResize());
  await flush();
}

describe("columnFit: 'hide'", () => {
  it('hides from the right when the width runs out, and brings them back as it widens', async () => {
    widths.container = 1000;
    await draw();
    expect(headers()).toEqual(['a', 'b', 'c']);

    await resize(400); // 200 + 150 fits, the third does not
    expect(headers()).toEqual(['a', 'b']);

    await resize(510); // 500 needed, + 24 to come back: not yet
    expect(headers()).toEqual(['a', 'b']);
    await resize(530);
    expect(headers()).toEqual(['a', 'b', 'c']);
  });

  it('keeps a column with a higher priority, the first and a header-less one always', async () => {
    widths.container = 400;
    await draw({
      columns: [
        { field: 'a', header: 'Alpha' },
        { field: 'b', header: 'Beta' },
        { field: 'c', header: 'Gamma', priority: 5 },
        { type: 'ui', field: 'd', header: '', cell: () => '⋯' },
      ],
    });
    // a and d are essential (240); c wins by priority (390); b no longer fits.
    expect(headers()).toEqual(['a', 'c', 'd']);
  });

  it('a column switched on in the menu outranks the rest', async () => {
    widths.container = 400;
    await draw({
      columns: [
        { field: 'a', header: 'Alpha' },
        { field: 'b', header: 'Beta' },
        { field: 'c', header: 'Gamma', initiallyHidden: true },
      ],
    });
    expect(headers()).toEqual(['a', 'b']);
    act(() => easyVisionRegistry.getState().patch('t-table', { columnVisibility: { c: true } } as never));
    await flush();
    expect(headers()).toEqual(['a', 'c']);
  });

  it("is screen state only: the menu keeps it ticked and says why; the saved choice is untouched", async () => {
    widths.container = 400;
    await draw();
    expect(headers()).toEqual(['a', 'b']);
    const slice = easyVisionRegistry.getState().slices['t-table'] as { columnVisibility: Record<string, boolean> };
    expect(slice.columnVisibility).toEqual({});

    const trigger = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Columnas'))!;
    act(() => {
      trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    });
    await flush();
    const gamma = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((i) =>
      i.textContent?.startsWith('Gamma')
    )!;
    expect(gamma.getAttribute('aria-checked')).toBe('true');
    expect(gamma.textContent).toContain('(sin sitio)');
  });

  it("never hides in 'scroll' mode, nor without a measurement", async () => {
    widths.container = 400;
    await draw({ columnFit: 'scroll' });
    expect(headers()).toEqual(['a', 'b', 'c']);

    act(() => root.render(<></>));
    easyVisionRegistry.setState({ slices: {} } as never);
    widths.container = 0;
    await draw();
    expect(headers()).toEqual(['a', 'b', 'c']);
  });
});
