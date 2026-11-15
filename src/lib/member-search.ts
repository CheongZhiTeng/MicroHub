/** Quote PostgREST filter values and escape LIKE wildcards without dropping name characters. */
export function memberSearchFilter(search: string): string | null {
  const term = search.trim().slice(0, 100);
  if (!term) return null;
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const quoted = JSON.stringify(pattern);
  return `display_name.ilike.${quoted},student_id.ilike.${quoted}`;
}
