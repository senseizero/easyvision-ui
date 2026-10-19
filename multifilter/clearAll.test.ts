// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyVisionMultifilter } from './EasyVisionMultifilter';
import type { MultifilterConfig, MultifilterSnapshot } from '../types/multifilter.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config: MultifilterConfig = {
  searchField: { id: 'q', type: 'text', label: 'Buscar', field: 'name' },
  fields: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function typeInSearch(text: string) {
  const input = container.querySelector<HTMLInputElement>('input.ev-mf-search-input')!;
  // React tracks the native value; go through the prototype setter so the
  // change is seen as user input.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickButton(label: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  act(() => button.click());
}

async function flushMicrotasks() {
  await act(async () => {});
}

function render(id: string, onPerform: (s: MultifilterSnapshot) => void) {
  act(() => {
    root.render(createElement(EasyVisionMultifilter, { id, config, performButton: true, onPerform }));
  });
}

describe('EasyVisionMultifilter "Limpiar"', () => {
  it('re-performs with an empty query after a confirmed search', async () => {
    const onPerform = vi.fn();
    render('clear-after-search', onPerform);

    typeInSearch('SUMOL');
    clickButton('Buscar');
    await flushMicrotasks();
    expect(onPerform).toHaveBeenCalledTimes(1);
    expect(onPerform.mock.calls[0][0].query.where).toBeDefined();

    clickButton('Limpiar');
    await flushMicrotasks();
    expect(onPerform).toHaveBeenCalledTimes(2);
    expect(onPerform.mock.calls[1][0].query.where).toBeUndefined();
  });

  it('does not perform when nothing was searched yet', async () => {
    const onPerform = vi.fn();
    render('clear-without-search', onPerform);

    typeInSearch('SUMOL');
    clickButton('Limpiar');
    await flushMicrotasks();
    expect(onPerform).not.toHaveBeenCalled();
  });
});

describe('EasyVisionMultifilter "Limpiar" with default filters', () => {
  // A default is the blank state of its field: "Limpiar" goes back to it.
  const withDefault: MultifilterConfig = {
    searchField: { id: 'q', type: 'text', label: 'Buscar', field: 'name' },
    fields: [{ id: 'origin', type: 'text', label: 'Origen', field: 'origin', initiallyActive: true, defaultValue: 'FORUM' }],
  };

  it('restores the defaults and re-performs with them', async () => {
    const onPerform = vi.fn();
    act(() => {
      root.render(createElement(EasyVisionMultifilter, { id: 'clear-defaults', config: withDefault, performButton: true, onPerform }));
    });

    typeInSearch('SUMOL');
    clickButton('Buscar');
    await flushMicrotasks();
    expect(onPerform.mock.lastCall![0].query.where).toEqual({
      name: { $regex: '.*SUMOL.*', $options: 'i' },
      origin: { $regex: '.*FORUM.*', $options: 'i' },
    });

    clickButton('Limpiar');
    await flushMicrotasks();
    const cleared = onPerform.mock.lastCall![0];
    expect(cleared.query.where).toEqual({ origin: { $regex: '.*FORUM.*', $options: 'i' } });
    expect(cleared.activeFields).toContain('origin');
  });
});
