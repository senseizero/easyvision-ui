/**
 * Escape regex metacharacters so user input matches literally inside a
 * `$regex` pattern (e.g. `SUMOL+COMPAL` must not read `+` as a quantifier).
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
