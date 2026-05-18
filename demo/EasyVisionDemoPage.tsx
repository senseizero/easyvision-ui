import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import {
  EasyVisionInput,
  EasyVisionSelector,
  EasyVisionMultifilter,
  EasyVisionTable,
  easyVisionRegistry,
} from '../index';
import type {
  ApiFetchParams,
  ApiFetchResult,
  EasyVisionColumn,
  MultifilterConfig,
  MultifilterSnapshot,
  SelectionChange,
} from '../index';
import {
  countryOptions,
  generateSampleData,
  levelOptions,
  sectorOptions,
  statusOptions,
  type DemoRow,
} from './sample-config';
import { EasyVisionCard } from '../card/EasyVisionCard';

const SAMPLE = generateSampleData(200);

function StoreInspector() {
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = easyVisionRegistry.subscribe(() => force((n) => n + 1));
    return unsub;
  }, []);
  const slices = easyVisionRegistry.getState().slices;
  const keys = Object.keys(slices);
  return (
    <pre className="text-[10px] leading-tight max-h-72 overflow-auto rounded border bg-muted p-2">
      {keys.length === 0
        ? '(registry empty)'
        : keys
            .sort()
            .map((k) => `${k}\n  ${JSON.stringify(slices[k])}`)
            .join('\n\n')}
    </pre>
  );
}

function PrimitivesSection() {
  const [mounted, setMounted] = useState(true);
  return (
    <EasyVisionCard className="rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">1. Standalone primitives</h2>
      <div className="flex items-center gap-3 mb-3">
        <Button size="sm" variant="outline" onClick={() => setMounted((m) => !m)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Press to verify cleanup-on-unmount (slices disappear from the registry).
        </span>
      </div>
      {mounted && (
        <div className="grid grid-cols-2 gap-4">
          <EasyVisionInput
            id="demoInput"
            label="Input (debounced 300ms, search icon, mandatory)"
            placeholder="Type something..."
            icon="search"
            mandatory
            showClearButton
            onChange={(v) => console.log('[demoInput]', v)}
          />
          <EasyVisionSelector
            id="demoSelector"
            label="Selector (mandatory, searchable)"
            placeholder="Pick a country..."
            options={countryOptions}
            mandatory
            searchable
            onChange={(v) => console.log('[demoSelector]', v)}
          />
        </div>
      )}
      <h3 className="text-sm font-medium mt-4 mb-1">Registry inspector</h3>
      <StoreInspector />
    </EasyVisionCard>
  );
}

function MultifilterSection() {
  const [editable, setEditable] = useState(true);
  const [snap, setSnap] = useState<MultifilterSnapshot | null>(null);

  const config = useMemo<MultifilterConfig>(
    () => ({
      searchField: {
        id: 'name',
        type: 'text',
        field: 'client.name',
        label: 'Búsqueda',
        placeholder: 'Buscar cliente...',
      },
      fields: [
        {
          id: 'level',
          type: 'multiselect',
          field: 'level',
          label: 'Nivel',
          pinned: true,
          mandatory: true,
          options: levelOptions,
        },
        {
          id: 'status',
          type: 'selector',
          field: 'status',
          label: 'Estado',
          pinned: true,
          options: statusOptions,
        },
        {
          id: 'dates',
          type: 'dateRange',
          field: 'created',
          label: 'Fechas',
        },
        {
          id: 'score',
          type: 'numberRange',
          field: 'score',
          label: 'Score',
        },
        {
          id: 'clientFilter',
          type: 'multifilter',
          label: 'Cliente avanzado',
          config: {
            fields: [
              {
                id: 'sector',
                type: 'selector',
                field: 'client.sector',
                label: 'Sector',
                options: sectorOptions,
              },
              {
                id: 'country',
                type: 'selector',
                field: 'client.country',
                label: 'País',
                options: countryOptions,
              },
            ],
          },
        },
      ],
    }),
    []
  );

  return (
    <EasyVisionCard className="rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">2. Multifilter alone</h2>
      <div className="flex items-center gap-3 mb-3">
        <Button size="sm" variant="outline" onClick={() => setEditable((e) => !e)}>
          {editable ? 'Disable add/remove (static)' : 'Enable add/remove'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Toggle <code>editable</code>. When off the "+" button and X chips disappear.
        </span>
      </div>
      <EasyVisionMultifilter
        id="demoMultifilter"
        config={config}
        editable={editable}
        performButton
        performLabel="Buscar"
        onPerform={setSnap}
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <h3 className="text-sm font-medium mb-1">Last perform snapshot</h3>
          <pre className="text-[10px] leading-tight max-h-72 overflow-auto rounded border bg-muted p-2">
            {snap ? JSON.stringify(snap, null, 2) : '(press Buscar)'}
          </pre>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-1">Registry</h3>
          <StoreInspector />
        </div>
      </div>
    </EasyVisionCard>
  );
}

const TABLE_COLUMNS: EasyVisionColumn<DemoRow>[] = [
  { field: 'created', header: 'Fecha' },
  { field: 'client.name', header: 'Cliente' },
  { field: 'client.sector', header: 'Sector', sortable: true },
  { field: 'client.country', header: 'País' },
  { field: 'level', header: 'Nivel' },
  { field: 'status', header: 'Estado' },
  { field: 'score', header: 'Score' },
  { field: 'amount', header: 'Importe', initiallyHidden: true },
];

function applyFilter(rows: DemoRow[], where: Record<string, unknown> | undefined): DemoRow[] {
  if (!where) return rows;
  return rows.filter((r) => {
    for (const [path, cond] of Object.entries(where)) {
      const value = path.split('.').reduce<unknown>(
        (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
        r as unknown
      );
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        const c = cond as Record<string, unknown>;
        if ('$regex' in c) {
          const pattern = String(c.$regex).replace(/^\.\*|\.\*$/g, '');
          if (!String(value ?? '').toLowerCase().includes(pattern.toLowerCase())) return false;
        }
        if ('$in' in c) {
          const arr = c.$in as (string | number)[];
          if (!arr.includes(value as never)) return false;
        }
        if ('$gte' in c && value != null && (value as number) < (c.$gte as number)) return false;
        if ('$lte' in c && value != null && (value as number) > (c.$lte as number)) return false;
      } else {
        if (value !== cond) return false;
      }
    }
    return true;
  });
}

function TableSection() {
  const [filteredRows, setFilteredRows] = useState<DemoRow[]>(SAMPLE);

  const localMultifilter = useMemo<MultifilterConfig>(
    () => ({
      searchField: { id: 'name', type: 'text', field: 'client.name', label: 'Búsqueda', placeholder: 'Buscar...' },
      fields: [
        { id: 'level', type: 'multiselect', field: 'level', label: 'Nivel', pinned: true, options: levelOptions },
        { id: 'status', type: 'selector', field: 'status', label: 'Estado', options: statusOptions },
      ],
    }),
    []
  );

  const fakeFetch = async (p: ApiFetchParams): Promise<ApiFetchResult<DemoRow>> => {
    await new Promise((r) => setTimeout(r, 200));
    let rows = applyFilter(SAMPLE, p.filter?.where);
    if (p.sort) {
      rows = [...rows].sort((a, b) => {
        const get = (r: DemoRow) =>
          p.sort!.column.split('.').reduce<unknown>(
            (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
            r as unknown
          );
        const av = get(a);
        const bv = get(b);
        if (av == null && bv == null) return 0;
        if (av == null) return p.sort!.descending ? 1 : -1;
        if (bv == null) return p.sort!.descending ? -1 : 1;
        const cmp = String(av).localeCompare(String(bv));
        return p.sort!.descending ? -cmp : cmp;
      });
    }
    const totalCount = rows.length;
    const start = (p.page - 1) * p.itemsPerPage;
    return { rows: rows.slice(start, start + p.itemsPerPage), totalCount };
  };

  const [selectionLog, setSelectionLog] = useState<SelectionChange | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  return (
    <EasyVisionCard className="rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">3. Tables (local + API)</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium mb-2">
            Local mode + <code>selectAllScope="page"</code> (nml-vision style)
          </h3>
          <EasyVisionTable<DemoRow>
            id="localTable"
            paginationMode="local"
            orderingMode="local"
            data={filteredRows}
            getRowId={(r) => r.id}
            columns={TABLE_COLUMNS}
            enableRowSelection
            selectAllScope="page"
            onSelectionChange={setSelectionLog}
            onRowClick={(row) => setHighlightedId(row.id)}
            isRowHighlighted={(row) => row.id === highlightedId}
            multifilter={{
              id: 'localFilter',
              config: localMultifilter,
              performButton: true,
              onPerform: (s) => {
                setFilteredRows(applyFilter(SAMPLE, s.query.where));
              },
            }}
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-medium mb-2">
            API mode + <code>selectAllScope="toggleable"</code> (chevron lets you switch to "all")
          </h3>
          <EasyVisionTable<DemoRow>
            id="apiTable"
            paginationMode="api"
            orderingMode="api"
            fetchData={fakeFetch}
            getRowId={(r) => r.id}
            columns={TABLE_COLUMNS}
            enableRowSelection
            selectAllScope="toggleable"
            onSelectionChange={setSelectionLog}
            onRowClick={(row) => setHighlightedId(row.id)}
            isRowHighlighted={(row) => row.id === highlightedId}
            multifilter={{
              id: 'apiFilter',
              config: localMultifilter,
              performButton: true,
              performOnMount: false,
            }}
          />
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <h3 className="text-sm font-medium mb-2">
          API mode + <code>selectAllResolution="eager-ids"</code> (paginates id list only — no rows materialized)
        </h3>
        <EasyVisionTable<DemoRow>
          id="apiTableEagerIds"
          paginationMode="api"
          orderingMode="api"
          fetchData={fakeFetch}
          getRowId={(r) => r.id}
          columns={TABLE_COLUMNS}
          enableRowSelection
          selectAllScope="toggleable"
          selectAllResolution="eager-ids"
          onSelectionChange={setSelectionLog}
          onRowClick={(row) => setHighlightedId(row.id)}
          isRowHighlighted={(row) => row.id === highlightedId}
          multifilter={{
            id: 'apiFilterEagerIds',
            config: localMultifilter,
            performButton: true,
            performOnMount: false,
          }}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm">
          <strong>Highlighted row:</strong>{' '}
          <code>{highlightedId ?? '(none)'}</code>
        </span>
        {highlightedId && (
          <button
            type="button"
            className="text-xs underline text-muted-foreground hover:text-foreground"
            onClick={() => setHighlightedId(null)}
          >
            clear
          </button>
        )}
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-medium mb-1">Last selection event</h3>
        <pre className="text-[10px] leading-tight max-h-32 overflow-auto rounded border bg-muted p-2">
          {selectionLog ? JSON.stringify(selectionLog, null, 2) : '(none)'}
        </pre>
      </div>
    </EasyVisionCard>
  );
}

export default function EasyVisionDemoPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">EasyVision demo</h1>
        <p className="text-sm text-muted-foreground">
          Exercises every feature combination. Existing pages (AlertView etc.) are untouched.
        </p>
      </header>
      <PrimitivesSection />
      <MultifilterSection />
      <TableSection />
    </div>
  );
}
