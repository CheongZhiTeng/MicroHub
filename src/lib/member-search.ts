/** Quote PostgREST filter values and escape LIKE wildcards without dropping name characters. */
export function memberSearchFilter(
  search: string,
  bilingual: boolean,
): string | null {
  const term = search.trim().slice(0, 100);
  if (!term) return null;
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const quoted = JSON.stringify(pattern);
  const columns = bilingual
    ? ['display_name', 'name_zh', 'name_en', 'student_id']
    : ['display_name', 'student_id'];
  return columns.map((column) => `${column}.ilike.${quoted}`).join(',');
}
