/**
 * LoopBack adapter for `EasyVisionTable`.
 *
 * Provides the canonical LoopBack `Filter` / `WhereValue` / `CountResponse`
 * shapes plus a fetcher factory (`createLoopbackTableFetcher`) compatible with
 * the table's `api` pagination/ordering mode. The factory handles the
 * boilerplate of:
 *   - mapping the table sort to LoopBack `order`
 *   - computing `skip` from page/itemsPerPage
 *   - extracting `where` from the merged filter (multifilter ∪ external)
 *   - issuing rows + count requests in parallel
 *   - only sending `where` to the count endpoint
 *
 * The library makes no assumptions about how the HTTP requests are issued —
 * `fetchPage` and `fetchCount` are plain async functions. Bring your own
 * authentication, base URL, error handling, etc.
 *
 * Pages can also import `LoopbackFilter` / `LoopbackWhereValue` directly to
 * build hand-rolled filters (e.g. the `toCondition` of a custom multifilter
 * field) without reaching for project-internal type modules.
 */
import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';

/**
 * LoopBack `where` clause primitive. Mirrors LoopBack 3/4 query operators.
 */
export type LoopbackWhereValue =
  | string
  | number
  | boolean
  | { $in: (string | number | boolean)[] }
  | { $nin: (string | number | boolean)[] }
  | { $regex: string; $options?: string }
  | { $gte?: string | number; $lte?: string | number }
  | { $or: Record<string, LoopbackWhereValue>[] }
  | { $and: Record<string, LoopbackWhereValue>[] }
  | Record<string, unknown>;

/**
 * LoopBack `Filter` object. Permissive on `where` so projects' own stricter
 * filter types remain assignable.
 */
export interface LoopbackFilter {
  where?: { [key: string]: LoopbackWhereValue } | Record<string, any>;
  fields?: string[];
  excludeFields?: string[];
  include?: object[];
  order?: string[];
  limit?: number;
  skip?: number;
}

export interface LoopbackCountResponse {
  count: number;
}

export interface CreateLoopbackTableFetcherOptions<T> {
  /** Returns the page of rows for the given LoopBack filter. */
  fetchPage: (filter: LoopbackFilter) => Promise<T[]>;
  /** Returns `{ count }` for the given LoopBack filter (only `where` is used). */
  fetchCount: (filter: LoopbackFilter) => Promise<LoopbackCountResponse>;
  /** LoopBack `include` clause applied to every page fetch. */
  include?: object[];
  /** LoopBack `fields` clause (whitelist) applied to every page fetch. */
  fields?: string[];
  /** Order applied when the table has no active sort. */
  defaultOrder?: string[];
  /**
   * Field(s) requested when the table sets `idsOnly` (eager-ids select-all
   * resolution). Defaults to `['id']`. Override if your model's primary key
   * is named differently or if `getRowId` reads from another property.
   */
  idFields?: string[];
}

export function createLoopbackTableFetcher<T = unknown>(
  opts: CreateLoopbackTableFetcherOptions<T>
) {
  const { fetchPage, fetchCount, include, fields, defaultOrder, idFields } =
    opts;

  return async ({
    page,
    itemsPerPage,
    sort,
    filter,
    idsOnly,
  }: ApiFetchParams): Promise<ApiFetchResult<T>> => {
    const order = sort
      ? [`${sort.column} ${sort.descending ? 'DESC' : 'ASC'}`]
      : defaultOrder ?? [];
    const skip = (page - 1) * itemsPerPage;
    const where: Record<string, any> = filter?.where ?? {};

    // idsOnly overrides the configured `fields` whitelist and skips `include`
    // (no point loading relations when the caller is throwing rows away).
    const effectiveFields = idsOnly ? idFields ?? ['id'] : fields;
    const effectiveInclude = idsOnly ? undefined : include;

    const pageFilter: LoopbackFilter = {
      where,
      skip,
      limit: itemsPerPage,
      order,
      ...(effectiveInclude ? { include: effectiveInclude } : {}),
      ...(effectiveFields ? { fields: effectiveFields } : {}),
    };

    const [rows, count] = await Promise.all([
      fetchPage(pageFilter),
      fetchCount({ where }),
    ]);

    return { rows, totalCount: count.count };
  };
}

/* -------------------------------------------------------------------------- */
/* matchLoopbackWhere — pure in-memory evaluator for a LoopBack `where` clause */
/* -------------------------------------------------------------------------- */
/**
 * Evaluate a LoopBack `where` clause against a single row, returning `true`
 * iff the row satisfies the clause.
 *
 * This is the canonical in-memory counterpart to the LoopBack DSL spoken by
 * `createLoopbackTableFetcher` and the multifilter. Use it to power local-mode
 * table filtering, derive filtered selectors from cached datasets, run
 * client-side previews of complex filters, etc. — anywhere you'd otherwise
 * hand-write equivalent JS.
 *
 * Supported features:
 *  - Field equality on primitives (`{ status: 'OPEN' }`).
 *  - Operator objects: `$eq`, `$ne` / `$neq`, `$in`, `$nin`, `$gt`, `$gte`,
 *    `$lt`, `$lte`, `$regex` (with optional `$options`), `$exists`.
 *  - Logical combinators: `$and`, `$or`, `$not`.
 *  - Arbitrary-depth dotted paths (e.g. `'client.address.country'`).
 *  - Array fan-out: when a path traverses an array of objects, the field is
 *    considered to match if any element matches.
 *
 * Behavior on edge cases:
 *  - `undefined` / empty `where` → `true` (no filter).
 *  - Unknown `$operator` → `false` (fail-closed) to surface bugs early.
 *  - Plain-object equality (e.g. `{ a: { b: 1 } }`) is intentionally not
 *    supported; use dotted paths or `$and` instead.
 */
export function matchLoopbackWhere(
  row: unknown,
  where: LoopbackFilter['where'] | undefined
): boolean {
  if (!where) return true;
  const w = where as Record<string, unknown>;
  const keys = Object.keys(w);
  if (keys.length === 0) return true;

  for (const key of keys) {
    const value = w[key];
    if (key === '$and') {
      if (!Array.isArray(value)) return false;
      if (!value.every((sub) => matchLoopbackWhere(row, sub as LoopbackFilter['where']))) {
        return false;
      }
      continue;
    }
    if (key === '$or') {
      if (!Array.isArray(value)) return false;
      if (!value.some((sub) => matchLoopbackWhere(row, sub as LoopbackFilter['where']))) {
        return false;
      }
      continue;
    }
    if (key === '$not') {
      if (matchLoopbackWhere(row, value as LoopbackFilter['where'])) return false;
      continue;
    }
    // Field key (possibly dotted). Field matches if ANY resolved value matches.
    const values = resolvePath(row, key.split('.'));
    if (!values.some((v) => matchLeaf(v, value))) return false;
  }
  return true;
}

/** Walks a dotted path; arrays are fanned out (returns one entry per leaf). */
function resolvePath(node: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [node];
  if (node == null) return [undefined];
  if (Array.isArray(node)) {
    return node.flatMap((item) => resolvePath(item, path));
  }
  if (typeof node !== 'object') return [undefined];
  const [head, ...rest] = path;
  return resolvePath((node as Record<string, unknown>)[head], rest);
}

/** Matches a single resolved value against either a primitive or an operator object. */
function matchLeaf(value: unknown, condition: unknown): boolean {
  // Primitive / null equality.
  if (condition === null || typeof condition !== 'object') {
    if (Array.isArray(value)) return value.some((v) => v === condition);
    return value === condition;
  }

  const cond = condition as Record<string, unknown>;
  const keys = Object.keys(cond);
  // An empty object matches anything.
  if (keys.length === 0) return true;
  // Treat as operator object only if at least one key starts with `$`.
  if (!keys.some((k) => k.startsWith('$'))) return false;

  for (const op of keys) {
    const arg = cond[op];
    switch (op) {
      case '$eq':
        if (Array.isArray(value) ? !value.includes(arg as never) : value !== arg) return false;
        break;
      case '$ne':
      case '$neq':
        if (Array.isArray(value) ? value.includes(arg as never) : value === arg) return false;
        break;
      case '$in':
        if (!Array.isArray(arg)) return false;
        if (Array.isArray(value)) {
          if (!value.some((v) => (arg as unknown[]).includes(v))) return false;
        } else if (!(arg as unknown[]).includes(value)) {
          return false;
        }
        break;
      case '$nin':
        if (!Array.isArray(arg)) return false;
        if (Array.isArray(value)) {
          if (value.some((v) => (arg as unknown[]).includes(v))) return false;
        } else if ((arg as unknown[]).includes(value)) {
          return false;
        }
        break;
      case '$gt':
        if (value == null || !((value as never) > (arg as never))) return false;
        break;
      case '$gte':
        if (value == null || !((value as never) >= (arg as never))) return false;
        break;
      case '$lt':
        if (value == null || !((value as never) < (arg as never))) return false;
        break;
      case '$lte':
        if (value == null || !((value as never) <= (arg as never))) return false;
        break;
      case '$exists': {
        const exists = value !== undefined && value !== null;
        if (Boolean(arg) !== exists) return false;
        break;
      }
      case '$regex': {
        const opts = typeof cond.$options === 'string' ? (cond.$options as string) : '';
        let re: RegExp;
        try {
          re = arg instanceof RegExp ? arg : new RegExp(String(arg), opts);
        } catch {
          return false;
        }
        if (Array.isArray(value)) {
          if (!value.some((v) => typeof v === 'string' && re.test(v))) return false;
        } else if (typeof value !== 'string' || !re.test(value)) {
          return false;
        }
        break;
      }
      case '$options':
        // Consumed by $regex above.
        break;
      default:
        // Unknown operator: fail-closed to surface bugs.
        return false;
    }
  }
  return true;
}

