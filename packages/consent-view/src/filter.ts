import { VIEW_FIELDS, type ViewField, type ViewRecord } from "./types.ts";
import { assertNoSecretFields } from "./windows.ts";

const FIELD_SET = new Set<string>(VIEW_FIELDS);

export function isViewField(value: string): value is ViewField {
  return FIELD_SET.has(value);
}

export function sanitizeFields(fields: readonly string[]): ViewField[] {
  const seen = new Set<ViewField>();
  const out: ViewField[] = [];
  for (const field of fields) {
    if (!isViewField(field) || seen.has(field)) continue;
    seen.add(field);
    out.push(field);
  }
  return out;
}

/** Drops every key the grant did not allow. Extra or secret keys never reach the web UI. */
export function filterRecords(
  records: readonly Record<string, unknown>[],
  allowed: readonly ViewField[],
): ViewRecord[] {
  const allow = new Set(allowed);
  return records.map((record) => {
    assertNoSecretFields(record, "record");
    const next: ViewRecord = {};
    for (const field of VIEW_FIELDS) {
      if (!allow.has(field)) continue;
      const value = record[field];
      if (typeof value === "string" && value.length > 0) next[field] = value;
    }
    return next;
  });
}
