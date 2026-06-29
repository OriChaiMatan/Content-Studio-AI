import type { GeneratedOutput } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Output punctuation sanitizer
//
// Product rule: generated outputs must NOT contain em dashes (— / U+2014). Use
// commas, periods, or parentheses instead. The engine system prompt asks the model
// to avoid them; THIS layer is the deterministic guarantee — it runs on EVERY
// generated output (claude / mock / fallback) regardless of model compliance.
//
// Scope is deliberately narrow to avoid breaking Hebrew/English punctuation:
//   - ONLY the em dash (U+2014) is touched.
//   - Hyphen-minus (-), en dash (– U+2013, e.g. number ranges "5–10"), and the
//     Hebrew maqaf (־ U+05BE) are LEFT ALONE.
//   - Any spaces/tabs immediately around the em dash are absorbed into the single
//     replacement, so "a — b", "a—b", "a —b", and "a— b" all become "a, b" with no
//     doubled spaces or stray " ," artifacts. Newlines are preserved (not consumed).
// ─────────────────────────────────────────────────────────────────────────────

const EM_DASH = /[ \t]*—[ \t]*/g;

/** Replace every em dash (with its surrounding spaces/tabs) with a comma + space. */
export function removeEmDashes(text: string): string {
  return text.replace(EM_DASH, ', ');
}

/** Apply removeEmDashes to every user-facing TEXT field of a generated output:
 *  title, readyToPublish, and the platform breakdown's string / string[] fields.
 *  Metadata (versions, model names, scores) is intentionally left untouched. */
export function stripEmDashes(out: GeneratedOutput): GeneratedOutput {
  const breakdown = out.breakdown as Record<string, unknown>;
  const cleanedBreakdown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(breakdown)) {
    if (typeof value === 'string') {
      cleanedBreakdown[key] = removeEmDashes(value);
    } else if (Array.isArray(value)) {
      cleanedBreakdown[key] = value.map(v => (typeof v === 'string' ? removeEmDashes(v) : v));
    } else {
      cleanedBreakdown[key] = value;
    }
  }
  return {
    ...out,
    title: removeEmDashes(out.title),
    readyToPublish: removeEmDashes(out.readyToPublish),
    breakdown: cleanedBreakdown,
  } as GeneratedOutput;
}
