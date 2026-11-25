import { expect, it } from 'vitest';
import { fitColumns, type FitCandidate } from './autofit';

const candidate = (partial: Partial<FitCandidate> & { id: string }): FitCandidate => ({
  width: 100,
  priority: 0,
  essential: false,
  hidden: false,
  ...partial,
});

it('keeps the essentials whatever the width', () => {
  const visible = fitColumns(
    [
      candidate({ id: 'name', essential: true, width: 300 }),
      candidate({ id: 'actions', essential: true, width: 50 }),
      candidate({ id: 'extra' }),
    ],
    10
  );
  expect(visible).toEqual(new Set(['name', 'actions']));
});

it('adds by priority while it fits; ties keep the left one', () => {
  const visible = fitColumns(
    [
      candidate({ id: 'name', essential: true, width: 200 }),
      candidate({ id: 'a', width: 100, priority: 0 }),
      candidate({ id: 'b', width: 100, priority: 5 }),
      candidate({ id: 'c', width: 100, priority: 0 }),
    ],
    400
  );
  expect(visible).toEqual(new Set(['name', 'b', 'a']));
});

it('a hidden column pays the hysteresis margin to come back', () => {
  const shown = (width: number, hidden: boolean) =>
    fitColumns(
      [candidate({ id: 'name', essential: true, width: 200 }), candidate({ id: 'a', width: 100, hidden })],
      width
    ).has('a');
  expect(shown(300, false)).toBe(true);
  expect(shown(300, true)).toBe(false);
  expect(shown(324, true)).toBe(true);
});

it('an unmeasured column costs nothing: it enters, gets measured next pass', () => {
  const visible = fitColumns(
    [candidate({ id: 'name', essential: true, width: 200 }), candidate({ id: 'new', width: 0 })],
    200
  );
  expect(visible.has('new')).toBe(true);
});
