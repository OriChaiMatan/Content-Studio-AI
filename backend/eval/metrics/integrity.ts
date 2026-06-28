// ─────────────────────────────────────────────────────────────────────────────
// Fact-integrity metrics (Phase 3A) — deterministic, no Claude.
//
// Minimal by design: we check whether a fixture's PLANTED unsupported claim was
// asserted (and whether as fact vs hedged), and what the mock fact check labeled
// it. No general-purpose claim extraction, no semantic matching, no LLM judge.
// ─────────────────────────────────────────────────────────────────────────────

// Bilingual (EN + HE) hedge markers. If one appears in the sentence carrying the
// planted phrase, we treat the assertion as HEDGED rather than stated-as-fact.
export const HEDGE_MARKERS: string[] = [
  // English
  'may', 'might', 'could', 'reportedly', 'projected', 'projection', 'projecting',
  'projects', 'project', 'claims', 'claimed', 'estimated', 'estimate', 'suggests',
  'appears', 'likely', 'possibly', 'allegedly', 'expected to', 'aims to', 'plans to',
  'forecast', 'forecasts', 'forecasting', 'according to', 'is said to', 'potential', 'up to',
  // Hebrew
  'אולי', 'עשוי', 'עשויה', 'ייתכן', 'לכאורה', 'כנראה', 'צפוי', 'צפויה',
  'מעריך', 'מעריכה', 'טוען', 'טוענת', 'עד כדי', 'לפי', 'מתכננת',
];

const lc = (s: string): string => s.toLowerCase();

export function phrasePresent(text: string, phrases: string[]): boolean {
  const t = lc(text);
  return phrases.some(p => t.includes(lc(p)));
}

// Split into rough sentences (works for EN and HE; periods / ! / ? / newlines).
export function splitSentences(text: string): string[] {
  return text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
}

export function sentencesWithPhrase(text: string, phrases: string[]): string[] {
  return splitSentences(text).filter(s => phrasePresent(s, phrases));
}

export type Assertion = 'as_fact' | 'hedged' | 'absent';

// Conservative: if ANY sentence carrying the planted phrase contains a hedge
// marker, classify as hedged; if present with no hedge nearby, as_fact.
export function classifyAssertion(text: string, phrases: string[]): Assertion {
  const hits = sentencesWithPhrase(text, phrases);
  if (hits.length === 0) return 'absent';
  const anyHedged = hits.some(s => HEDGE_MARKERS.some(h => lc(s).includes(lc(h))));
  return anyHedged ? 'hedged' : 'as_fact';
}

// A minimal FactCheckReport shape — only the fields we read here.
export interface FactCheckLike {
  verifiedClaims?:   { claim: string }[];
  uncertainClaims?:  { claim: string }[];
  conflictingClaims?:{ claim: string }[];
}

export interface FactCheckMatch {
  verified:   string[];   // matched claim strings in each bucket
  uncertain:  string[];
  conflicting:string[];
}

export function findInFactCheck(report: FactCheckLike, phrases: string[]): FactCheckMatch {
  const match = (arr?: { claim: string }[]) =>
    (arr ?? []).map(c => c.claim).filter(claim => phrasePresent(claim, phrases));
  return {
    verified:    match(report.verifiedClaims),
    uncertain:   match(report.uncertainClaims),
    conflicting: match(report.conflictingClaims),
  };
}
