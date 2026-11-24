/**
 * ingot adapter (NML v3 backend) — sibling of `adapters/loopback.ts`.
 *
 * The multifilter and local mode speak one `where` dialect: LoopBack keys
 * with mongo-style operators (`$in`, `$gte`, `$regex`, `$or`…), which westack
 * accepts as-is. ingot keeps LoopBack's `?filter=` shape but only accepts
 * operator names without `$` (`inq`, `gte`, `ilike`, `or`…): a `$` operator
 * is a 400, a top-level `$or` a 500. This adapter translates on the way out,
 * so nothing upstream changes.
 *
 * Behaviour checked against nml-cloud@wip/v3 in dev (2026-11-24):
 *   - `like` / `ilike` are a literal substring match (`%`, `.`, `(` match
 *     themselves; no wildcards needed), case-sensitive / -insensitive.
 *   - `regexp` is disabled server-side and there is no `not`.
 *   - Lists sent with `limit` return the total in `X-Total-Count`, exposed
 *     to the browser by CORS, so one request per page is enough.
 */
import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';

/** ingot `filter` object (same shape as LoopBack's). */
export interface IngotFilter {
  where?: Record<string, unknown>;
  fields?: string[];
  include?: object[];
  order?: string[];
  limit?: number;
  skip?: number;
}

export interface CreateIngotTableFetcherOptions<T> {
  /**
   * Returns one page of rows plus the total, which ingot sends in the
   * `X-Total-Count` header of the same response (`filter` always carries
   * `limit`, so the header is always there).
   */
  fetchPage: (filter: IngotFilter) => Promise<ApiFetchResult<T>>;
  /** `include` clause applied to every page fetch. */
  include?: object[];
  /** `fields` clause (whitelist) applied to every page fetch. */
  fields?: string[];
  /** Order applied when the table has no active sort, e.g. `['updatedAt DESC']`. */
  defaultOrder?: string[];
  /** Field(s) requested when the table sets `idsOnly`. Defaults to `['id']`. */
  idFields?: string[];
}

const OPERATORS: Record<string, string> = {
  $eq: 'eq',
  $ne: 'neq',
  $neq: 'neq',
  $in: 'inq',
  $nin: 'nin',
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
  $exists: 'exists',
};

const LOGICAL: Record<string, string> = { $and: 'and', $or: 'or' };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

/**
 * Turns a `$regex` into the literal it searches for, or `undefined` when it
 * is a real pattern. Accepted: escaped literals, optionally wrapped in `.*`
 * — exactly what the multifilter's text search builds (`.*${escapeRegex(s)}.*`).
 * An unanchored regex already matches anywhere, so `.*x.*` and `x` are the
 * same substring search.
 */
function regexToLiteral(pattern: string): string | undefined {
  const body = pattern.replace(/^\.\*/, '');
  let literal = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') {
      if (i + 1 >= body.length) return undefined;
      literal += body[++i];
    } else if (ch === '.' && body[i + 1] === '*' && i + 2 === body.length) {
      break; // trailing unescaped `.*`
    } else if ('.*+?^${}()|[]'.includes(ch)) {
      return undefined;
    } else {
      literal += ch;
    }
  }
  return literal;
}

function translateOperators(field: string, ops: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [op, value] of Object.entries(ops)) {
    if (!op.startsWith('$')) {
      out[op] = value; // already ingot-native
    } else if (op === '$regex') {
      const flags = ops.$options ?? '';
      if (flags !== '' && flags !== 'i') {
        throw new Error(`ingot: unsupported $options "${String(flags)}" on "${field}" (only "i")`);
      }
      const literal = typeof value === 'string' ? regexToLiteral(value) : undefined;
      if (literal === undefined) {
        throw new Error(`ingot: "${field}" uses a regex pattern; ingot only supports literal substring search`);
      }
      out[flags === 'i' ? 'ilike' : 'like'] = literal;
    } else if (op === '$options') {
      if (!('$regex' in ops)) throw new Error(`ingot: $options without $regex on "${field}"`);
    } else if (op in OPERATORS) {
      out[OPERATORS[op]] = value;
    } else {
      throw new Error(`ingot: unsupported operator ${op} on "${field}"`);
    }
  }
  return out;
}

/**
 * Translates a mongo-style LoopBack `where` (as built by the multifilter) into
 * ingot's dialect. Throws on anything ingot cannot express (`$not`, real regex
 * patterns, unknown `$` operators) rather than silently widening the query.
 */
export function toIngotWhere(where: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (key in LOGICAL) {
      if (!Array.isArray(value)) throw new Error(`ingot: ${key} expects an array`);
      out[LOGICAL[key]] = value.map((sub) => toIngotWhere(sub as Record<string, unknown>));
    } else if (key.startsWith('$')) {
      throw new Error(`ingot: unsupported operator ${key}`);
    } else if (isPlainObject(value) && Object.keys(value).some((k) => k.startsWith('$'))) {
      out[key] = translateOperators(key, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createIngotTableFetcher<T = unknown>(opts: CreateIngotTableFetcherOptions<T>) {
  const { fetchPage, include, fields, defaultOrder, idFields } = opts;

  return async ({ page, itemsPerPage, sort, filter, idsOnly }: ApiFetchParams): Promise<ApiFetchResult<T>> => {
    const order = sort ? [`${sort.column} ${sort.descending ? 'DESC' : 'ASC'}`] : defaultOrder ?? [];
    const effectiveFields = idsOnly ? idFields ?? ['id'] : fields;
    const effectiveInclude = idsOnly ? undefined : include;

    return fetchPage({
      where: toIngotWhere(filter?.where ?? {}),
      skip: (page - 1) * itemsPerPage,
      limit: itemsPerPage,
      order,
      ...(effectiveInclude ? { include: effectiveInclude } : {}),
      ...(effectiveFields ? { fields: effectiveFields } : {}),
    });
  };
}
