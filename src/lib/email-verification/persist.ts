import 'server-only';

const LEAD_VERIFICATION_COLUMNS = [
  'email_verification_provider',
  'email_verification_raw',
  'email_verified_at',
  'email_verification_reason',
  'email_verification_score',
  'email_verification_status',
  'email_verified',
] as const;

function errorIncludesColumn(error: { message?: string } | null | undefined, column: string) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column.toLowerCase());
}

export function getMissingLeadVerificationColumn(error: { message?: string } | null | undefined) {
  return LEAD_VERIFICATION_COLUMNS.find((column) => errorIncludesColumn(error, column)) || null;
}

function omitColumn<T extends Record<string, unknown>>(value: T, column: string): T {
  const nextValue = { ...value };
  delete nextValue[column];
  return nextValue as T;
}

export async function insertLeadsWithVerificationFallback<T extends Record<string, unknown>>({
  supabase,
  rows,
  select,
}: {
  supabase: any;
  rows: T[];
  select?: string;
}) {
  let currentRows = rows;
  const strippedColumns: string[] = [];

  while (true) {
    const response = select
      ? await supabase.from('leads').insert(currentRows).select(select)
      : await supabase.from('leads').insert(currentRows);

    if (!response.error) {
      return {
        data: response.data as Array<Record<string, unknown>> | null,
        error: null,
        strippedColumns,
      };
    }

    const missingColumn = getMissingLeadVerificationColumn(response.error);
    if (!missingColumn || strippedColumns.includes(missingColumn)) {
      return {
        data: response.data as Array<Record<string, unknown>> | null,
        error: response.error,
        strippedColumns,
      };
    }

    currentRows = currentRows.map((row) => omitColumn(row, missingColumn));
    strippedColumns.push(missingColumn);
  }
}

export async function updateLeadWithVerificationFallback({
  supabase,
  leadId,
  payload,
}: {
  supabase: any;
  leadId: string;
  payload: Record<string, unknown>;
}) {
  let currentPayload = payload;
  const strippedColumns: string[] = [];

  while (true) {
    const response = await supabase.from('leads').update(currentPayload).eq('id', leadId);

    if (!response.error) {
      return { error: null, strippedColumns };
    }

    const missingColumn = getMissingLeadVerificationColumn(response.error);
    if (!missingColumn || strippedColumns.includes(missingColumn)) {
      return { error: response.error, strippedColumns };
    }

    currentPayload = omitColumn(currentPayload, missingColumn);
    strippedColumns.push(missingColumn);
  }
}
