import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { strings, type StringKey } from './strings';
import type { Language } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// App Language (UI) translation hook. Reads the persisted App Language from the
// settings store (user.language) — the SAME value the Settings "App language"
// control writes. This is intentionally separate from user.defaultOutputLanguage
// (Content Output Language), which governs generated content only.
// ─────────────────────────────────────────────────────────────────────────────

function normalize(lang: string | undefined): Language {
  return lang === 'he' ? 'he' : 'en';
}

export type TParams = Record<string, string | number>;

// Replace {token} placeholders with params. Unknown tokens are left as-is.
function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function useT() {
  const lang = normalize(useSettingsStore(s => s.user.language));
  const dir: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';
  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  // Translate a UI string key, with optional {token} interpolation.
  // Missing key → English → key itself (never crashes).
  function t(key: StringKey, params?: TParams): string {
    const entry = strings[key];
    const raw = entry ? (entry[lang] ?? entry.en ?? key) : key;
    return interpolate(raw, params);
  }

  // Light pluralization: pick the singular or plural KEY by count, then translate
  // with { count } available. Hebrew entries may reuse one neutral form for both —
  // we never build fragile Hebrew plural grammar. Both keys stay StringKey-typed.
  function plural(count: number, oneKey: StringKey, otherKey: StringKey, params?: TParams): string {
    return t(count === 1 ? oneKey : otherKey, { count, ...params });
  }

  // Locale-aware date helpers (App Language drives the locale; content is unaffected).
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      + ', ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  return { t, plural, lang, dir, locale, formatDate, formatDateTime };
}

// Sets <html dir/lang> from the App Language, app-wide and reactively. Call once
// near the root so authed pages AND the login/register pages both flip together.
export function useAppDirection(): void {
  const lang = normalize(useSettingsStore(s => s.user.language));
  useEffect(() => {
    const root = document.documentElement;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    root.lang = lang;
  }, [lang]);
}
