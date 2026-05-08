export const isNestedAccessor = (accessor: string | undefined): boolean =>
  !!accessor && accessor.includes('.');

export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
