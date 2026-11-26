// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 import { EasyVisionDateChip } from './EasyVisionDateChip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const now = new Date('2026-11-25T14:05:00');
const render = (date: string | null) => {
  act(() => root.render(<EasyVisionDateChip date={date} now={now} />));
  return host.querySelector('.ev-date-chip')!;
};

describe('EasyVisionDateChip', () => {
  it.each([
    ['2026-11-25T08:00', 'solid'],
    ['2026-11-20', 'light'],
    ['2026-11-01', 'grey'],
    ['2026-09-01', 'outline'],
    ['2026-11-26', 'solid'],
  ])('%s -> %s', (d, step) => {
    expect(render(d).getAttribute('data-step')).toBe(step);
  });
  it('null and invalid render a dash without step', () => {
    for (const d of [null, 'nope']) {
      const el = render(d);
      expect(el.textContent).toBe('–');
      expect(el.hasAttribute('data-step')).toBe(false);
    }
  });
  it('formats dd/MM/yy', () => {
    expect(render('2026-11-24').textContent).toBe('24/11/26');
  });
});
