import { useCallback } from 'react';
import type {
  FieldDef,
  MultifilterConfig,
  MultifilterQuery,
  DateRangeValue,
  NumberRangeValue,
  TextFieldDef,
} from '../../types/multifilter.types';
import { escapeRegex } from '../../lib/escapeRegex';

/**
 * The terms of a text value: a list (the main search) or a single string (a
 * text filter, or older state). Trimmed, without blanks or repeats.
 */
export function toSearchTerms(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(raw.map((term) => String(term).trim()).filter(Boolean))];
}

/**
 * Literal, case-insensitive substring match of any term on any of
 * `def.fields` (or `def.field`). One term on one path is a plain condition;
 * anything more, one `$or` — exactly what a single term always built.
 */
export function textCondition(def: TextFieldDef, value: unknown): Record<string, unknown> | undefined {
  const terms = toSearchTerms(value);
  const paths = def.fields?.length ? def.fields : def.field ? [def.field] : [];
  if (terms.length === 0 || paths.length === 0) return undefined;
  const clauses = terms.flatMap((term) =>
    paths.map((path) => ({ [path]: { $regex: `.*${escapeRegex(term)}.*`, $options: 'i' } }))
  );
  // As a single term always was: `fields` an `$or`, one `field` a plain clause.
  if (!def.fields?.length && clauses.length === 1) return clauses[0];
  return { $or: clauses };
}

export function buildCondition(def: FieldDef, value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const mapper = def.toCondition ?? def.transform;
  if (mapper) {
    const mapped = mapper(value);
    if (mapped === undefined || mapped === null) return undefined;
    if (
      typeof mapped === 'object' &&
      !Array.isArray(mapped) &&
      ('$or' in (mapped as object) || '$and' in (mapped as object))
    ) {
      return mapped as Record<string, unknown>;
    }
    if (def.field) return { [def.field]: mapped };
    return undefined;
  }

  if (def.type === 'text') return textCondition(def, value);
  if (!def.field) return undefined;

  switch (def.type) {
    case 'selector': {
      return { [def.field]: value };
    }
    case 'multiselect': {
      const arr = value as (string | number)[];
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return { [def.field]: { $in: arr } };
    }
    case 'dateRange': {
      const r = value as DateRangeValue;
      if (!r?.from && !r?.to) return undefined;
      const cond: Record<string, string> = {};
      if (r.from) cond.$gte = r.from.toISOString();
      if (r.to) cond.$lte = r.to.toISOString();
      return { [def.field]: cond };
    }
    case 'numberRange': {
      const r = value as NumberRangeValue;
      if (r?.min == null && r?.max == null) return undefined;
      const cond: Record<string, number> = {};
      if (r.min != null) cond.$gte = r.min;
      if (r.max != null) cond.$lte = r.max;
      return { [def.field]: cond };
    }
    default:
      return undefined;
  }
}

export function useBuildQuery(
  config: MultifilterConfig,
  values: Record<string, unknown>,
  childQueries: Record<string, MultifilterQuery>
) {
  return useCallback((): MultifilterQuery => {
    const where: Record<string, unknown> = {};

    if (config.searchField) {
      const c = buildCondition(config.searchField, values[config.searchField.id]);
      if (c) Object.assign(where, c);
    }

    for (const def of config.fields) {
      if (def.type === 'multifilter') {
        const childWhere = childQueries[def.id]?.where;
        if (childWhere) Object.assign(where, childWhere);
        continue;
      }
      const c = buildCondition(def, values[def.id]);
      if (c) Object.assign(where, c);
    }

    const out: MultifilterQuery = {};
    if (Object.keys(where).length > 0) out.where = where;
    if (config.defaultOrder) out.order = config.defaultOrder;
    if (config.defaultLimit) out.limit = config.defaultLimit;
    return out;
  }, [config, values, childQueries]);
}
