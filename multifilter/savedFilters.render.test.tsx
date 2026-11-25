// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyVisionMultifilter } from './EasyVisionMultifilter';
import { easyVisionRegistry } from '../store/registry';
import type { MultifilterConfig, MultifilterSnapshot } from '../types/multifilter.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'nml.table.view:evaluaciones.saved.u1';
const config: MultifilterConfig = {
  fields: [
    {
      id: 'status',
      type: 'multiselect',
      label: 'Estado',
      field: 'status',
      pinned: true,
      options: [
        { value: 'DONE', label: 'Completada' },
        { value: 'FAILED', label: 'Fallida' },
      ],
    },
    { id: 'score', type: 'numberRange', label: 'Score', field: 'score' },
  ],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  easyVisionRegistry.setState({ slices: {} } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

function render(onPerform: (s: MultifilterSnapshot) => void) {
  act(() =>
    root.render(
      <EasyVisionMultifilter
        id="mf"
        config={config}
        performButton
        onPerform={onPerform}
        savedFilters={{ storageKey: KEY }}
      />
    )
  );
}

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;

describe('saved filters in the multifilter', () => {
  it('opens with the default saved query (written in the v3 shape) and performs it', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Fallidas altas', filters: { status: 'FAILED', score: { min: 3 } }, search: [] }],
        defaultName: 'Fallidas altas',
      })
    );
    const onPerform = vi.fn();
    render(onPerform);
    await flush();

    expect(onPerform).toHaveBeenCalledTimes(1);
    expect(onPerform.mock.calls[0][0].query.where).toEqual({
      status: { $in: ['FAILED'] },
      score: { $gte: 3 },
    });
    // Nothing changed since that search: Buscar has nothing new to do.
    expect(button('Buscar')!.disabled).toBe(true);
  });

  it('applies a saved query with one click and searches it', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Completadas', filters: { status: ['DONE'] }, search: [] }],
        defaultName: null,
      })
    );
    const onPerform = vi.fn();
    render(onPerform);
    await flush();
    expect(onPerform).not.toHaveBeenCalled();

    act(() => button('Guardados')!.click());
    await flush();
    act(() => button('Completadas')!.click());
    await flush();

    expect(onPerform).toHaveBeenCalledTimes(1);
    expect(onPerform.mock.calls[0][0].query.where).toEqual({ status: { $in: ['DONE'] } });
  });

  it('saves what is applied, not what is staged, and stars it as the default', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Completadas', filters: { status: ['DONE'] }, search: [] }],
        defaultName: null,
      })
    );
    render(() => {});
    await flush();

    // Nothing applied yet: nothing to save.
    act(() => button('Guardados')!.click());
    await flush();
    const input = () => document.querySelector('.ev-mf-saved-form input') as HTMLInputElement;
    expect(input().disabled).toBe(true);

    // Apply one, then save it under another name.
    act(() => button('Completadas')!.click());
    await flush();
    act(() => button('Guardados')!.click());
    await flush();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input(), 'Mis completadas');
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => button('Guardar')!.click());
    await flush();

    const star = document.querySelector('[aria-label="Abrir siempre con este: Mis completadas"]') as HTMLButtonElement;
    act(() => star.click());

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      items: [
        { name: 'Completadas', filters: { status: ['DONE'] }, search: [] },
        { name: 'Mis completadas', filters: { status: ['DONE'] }, search: [] },
      ],
      defaultName: 'Mis completadas',
    });
  });
});

describe('openWithDefault: false', () => {
  it('starts from the defaults the host gives (a shared link), not the saved default', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Fallidas', filters: { status: ['FAILED'] }, search: [] }],
        defaultName: 'Fallidas',
      })
    );
    const onPerform = vi.fn();
    const linked: MultifilterConfig = {
      fields: config.fields.map((f) => (f.id === 'status' ? { ...f, defaultValue: ['DONE'] } : f)),
    };
    act(() =>
      root.render(
        <EasyVisionMultifilter
          id="mf"
          config={linked}
          performButton
          performOnMount
          onPerform={onPerform}
          savedFilters={{ storageKey: KEY, openWithDefault: false }}
        />
      )
    );
    await flush();
    expect(onPerform.mock.calls[0][0].query.where).toEqual({ status: { $in: ['DONE'] } });
    // The menu is still there, default marked.
    act(() => button('Guardados')!.click());
    await flush();
    expect(button('Fallidas')).toBeTruthy();
  });
});

describe('a table whose multifilter opens with a saved default', () => {
  it('loads once, already filtered (no unfiltered flash)', async () => {
    const { EasyVisionTable } = await import('../table/EasyVisionTable');
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Fallidas', filters: { status: ['FAILED'] }, search: [] }],
        defaultName: 'Fallidas',
      })
    );
    const fetchData = vi.fn().mockResolvedValue({ rows: [], totalCount: 0 });
    act(() =>
      root.render(
        <EasyVisionTable
          id="t"
          paginationMode="api"
          orderingMode="api"
          fetchData={fetchData}
          columns={[{ field: 'status', header: 'Estado' }]}
          multifilter={{ id: 'mf', performButton: true, config, savedFilters: { storageKey: KEY } }}
        />
      )
    );
    await flush();
    await flush();

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData.mock.calls[0][0].filter.where).toEqual({ status: { $in: ['FAILED'] } });
  });

  it('still loads once, unfiltered, when nothing is saved', async () => {
    const { EasyVisionTable } = await import('../table/EasyVisionTable');
    const fetchData = vi.fn().mockResolvedValue({ rows: [], totalCount: 0 });
    act(() =>
      root.render(
        <EasyVisionTable
          id="t"
          paginationMode="api"
          orderingMode="api"
          fetchData={fetchData}
          columns={[{ field: 'status', header: 'Estado' }]}
          multifilter={{ id: 'mf', performButton: true, config, savedFilters: { storageKey: KEY } }}
        />
      )
    );
    await flush();
    await flush();

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData.mock.calls[0][0].filter?.where ?? {}).toEqual({});
  });
});

describe('searchFieldId', () => {
  const withSearch: MultifilterConfig = {
    fields: [{ id: 'q', type: 'text', label: 'Buscar', field: 'name', prominent: true, pinned: true }, ...config.fields],
  };

  it("reads v3's search terms into the search field and writes them back there", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        items: [{ name: 'Arts', filters: { status: ['DONE'] }, search: ['Art'] }],
        defaultName: 'Arts',
      })
    );
    const onPerform = vi.fn();
    act(() =>
      root.render(
        <EasyVisionMultifilter
          id="mf"
          config={withSearch}
          performButton
          onPerform={onPerform}
          savedFilters={{ storageKey: KEY, searchFieldId: 'q' }}
        />
      )
    );
    await flush();
    expect(onPerform.mock.calls[0][0].values).toMatchObject({ q: 'Art', status: ['DONE'] });

    act(() => button('Guardados')!.click());
    await flush();
    const input = document.querySelector('.ev-mf-saved-form input') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Otra');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => button('Guardar')!.click());
    expect(JSON.parse(localStorage.getItem(KEY)!).items[1]).toEqual({
      name: 'Otra',
      filters: { status: ['DONE'] },
      search: ['Art'],
    });
  });
});

describe('defaultSort', () => {
  async function mount() {
    const { EasyVisionTable } = await import('../table/EasyVisionTable');
    const fetchData = vi.fn().mockResolvedValue({ rows: [{ id: '1', a: 'x', b: 'y' }], totalCount: 1 });
    act(() =>
      root.render(
        <EasyVisionTable
          id="t"
          paginationMode="api"
          orderingMode="api"
          fetchData={fetchData}
          defaultSort={{ column: 'a', descending: true }}
          columns={[
            { field: 'a', header: 'A' },
            { field: 'b', header: 'B' },
          ]}
        />
      )
    );
    await flush();
    const th = (name: string) =>
      [...document.querySelectorAll('th')].find((h) => h.textContent?.startsWith(name))!;
    return { fetchData, th };
  }

  it("marks the default order's column and asks nothing extra", async () => {
    const { fetchData, th } = await mount();
    expect(th('A').getAttribute('aria-sort')).toBe('descending');
    expect(th('B').getAttribute('aria-sort')).toBeNull();
    expect(fetchData.mock.calls[0][0].sort).toBeNull();
  });

  it('turns the default column around on click, and back to the default clears the sort', async () => {
    const { fetchData, th } = await mount();
    act(() => th('A').querySelector('button')!.click());
    await flush();
    expect(th('A').getAttribute('aria-sort')).toBe('ascending');
    expect(fetchData.mock.calls[fetchData.mock.calls.length - 1][0].sort).toEqual({ column: 'a', descending: false });

    act(() => th('A').querySelector('button')!.click());
    await flush();
    expect(th('A').getAttribute('aria-sort')).toBe('descending');
    expect(fetchData.mock.calls[fetchData.mock.calls.length - 1][0].sort).toBeNull();
  });
});

describe('cells across renders', () => {
  it('keeps the same cell nodes when the host passes new column objects', async () => {
    const { EasyVisionTable } = await import('../table/EasyVisionTable');
    const rows = [{ id: '1', name: 'José' }];
    const draw = (n: number) =>
      act(() =>
        root.render(
          <EasyVisionTable
            id="t"
            data={rows}
            // A new array and new cell functions every render, as a page that
            // builds its columns inline does.
            columns={[{ field: 'name', header: `Nombre ${n}`, cell: (row: { name: string }) => <b>{row.name}</b> }]}
          />
        )
      );
    draw(1);
    await flush();
    const before = document.querySelector('td b');
    draw(2);
    await flush();
    const after = document.querySelector('td b');
    expect(after?.textContent).toBe('José');
    expect(after).toBe(before);
    expect(before?.isConnected).toBe(true);
  });
});
