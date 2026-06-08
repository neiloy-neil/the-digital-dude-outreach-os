export function isMissingTableError(
  error: { message?: string; code?: string } | null | undefined,
  tableName: string
): boolean {
  const message = String(error?.message || '').toLowerCase();
  const table = tableName.toLowerCase();
  return (
    error?.code === '42P01' ||
    message.includes(`could not find the table 'public.${table}' in the schema cache`) ||
    message.includes(`could not find the table \"public.${table}\" in the schema cache`) ||
    message.includes(`relation "public.${table}" does not exist`) ||
    message.includes(`${table} table is not available yet`) ||
    (message.includes(table) &&
      (message.includes('does not exist') || message.includes('not found') || message.includes('schema cache')))
  );
}
