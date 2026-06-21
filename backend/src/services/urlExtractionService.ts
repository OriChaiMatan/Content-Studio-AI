import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import dnsPromises from 'node:dns/promises';
import net from 'node:net';

// ─────────────────────────────────────────────────────────────────────────────
// URL Content Extraction Service (Phase 8.5)
//
// Fetches a URL safely and extracts readable article/page text so Source
// Analysis can run on real content instead of the bare URL string.
//
// extract() NEVER throws. Every failure mode (bad URL, unsupported protocol,
// private address, timeout, oversized body, non-HTML, too-short content)
// resolves to { status: 'failed', error } with a clean user-facing message —
// the caller always saves the source regardless.
//
// Security: http/https only, private/loopback IPs rejected (re-checked on every
// redirect hop), request timeout, response size cap, limited redirects, no JS
// execution, no credentials/cookies.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractionResult {
  // 'partial' = OG/meta preview text only (full article body unavailable) — still
  // usable by the pipeline, but the UI should invite a manual-text paste.
  status: 'success' | 'partial' | 'failed';
  title?: string;
  text?: string;
  error?: string; // safe, user-friendly — never a raw stack/technical detail
}

const TIMEOUT_MS = parseInt(process.env.URL_FETCH_TIMEOUT_MS ?? '8000', 10);
const MAX_BYTES = parseInt(process.env.URL_FETCH_MAX_CONTENT_BYTES ?? '2097152', 10);
const MAX_REDIRECTS = 3;
// Below this many characters of readable text, treat extraction as failed and
// fall back to URL+label analysis (per Phase 8.5 addition #1).
const MIN_READABLE_CHARS = 300;
// Minimum combined length of OG/meta title+description to accept as a metadata-only
// (partial) extraction when the full article body could not be read (Phase B).
const MIN_METADATA_CHARS = parseInt(process.env.URL_FETCH_MIN_METADATA_CHARS ?? '60', 10);
const USER_AGENT = 'ContentStudioAI/1.0 (+source-analysis; no-js)';

// Hosts that gate content behind login/JS and routinely block server-side
// extraction. Used ONLY to (a) skip the metadata-partial path — their OG tags are
// usually a generic login wall — and (b) tailor the failure message toward the
// manual-paste fallback. Never used to skip the fetch itself.
const AUTHWALLED_HOST_RE = /(^|\.)(linkedin\.com|facebook\.com|fb\.com|instagram\.com|x\.com|twitter\.com)$/i;
const SOCIAL_FAILURE_MSG =
  "We couldn't extract this social post automatically. Paste the post text manually.";

// Exported so other ingestion paths (e.g. WhatsApp recovery copy) classify social
// hosts the same way — never duplicate the host regex.
export function isAuthwalledHost(rawUrl: string): boolean {
  try { return AUTHWALLED_HOST_RE.test(new URL(rawUrl).hostname); }
  catch { return false; }
}

// ── Private / reserved address detection ─────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = p;
  if (a === 10) return true;                       // 10.0.0.0/8
  if (a === 127) return true;                      // loopback
  if (a === 0) return true;                        // 0.0.0.0/8
  if (a === 169 && b === 254) return true;         // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true;                       // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;          // loopback / unspecified
  if (lower.startsWith('fe80')) return true;                   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a parseable IP → unsafe
}

// Resolve the hostname and confirm no address falls in a private/reserved range.
// IP-literal hosts are checked directly without DNS.
async function assertHostSafe(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new SafeError('This URL points to a private or local address and cannot be fetched.');
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new SafeError('This URL points to a private or local address and cannot be fetched.');
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dnsPromises.lookup(host, { all: true });
  } catch {
    throw new SafeError('We could not resolve this website address.');
  }
  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new SafeError('This URL points to a private or local address and cannot be fetched.');
  }
}

// Internal error carrying a message already safe to show the user.
class SafeError extends Error {}

// ── Fetch with manual, re-validated redirects, timeout, and size cap ─────────

interface FetchResult {
  html: string;
  finalUrl: string;
}

async function safeFetch(initialUrl: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let url = initialUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new SafeError('This does not look like a valid URL.');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SafeError('Only http and https links can be analyzed.');
      }

      // Re-validate the host on EVERY hop to block redirect-to-internal SSRF.
      await assertHostSafe(parsed.hostname);

      const res = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain' },
        // No credentials/cookies are attached by default with fetch().
      });

      // Manual redirect handling (undici returns the 3xx with a Location header).
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) throw new SafeError('We could not reach this page.');
        if (hop === MAX_REDIRECTS) {
          throw new SafeError('This page redirected too many times.');
        }
        url = new URL(location, parsed).toString(); // resolve relative redirects
        continue;
      }

      if (!res.ok) {
        throw new SafeError('We could not reach this page (it returned an error).');
      }

      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new SafeError('This link is not a readable web page.');
      }

      const declaredLength = Number(res.headers.get('content-length') ?? '');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
        throw new SafeError('This page is too large to analyze.');
      }

      const html = await readBodyCapped(res);
      return { html, finalUrl: parsed.toString() };
    }
    // Loop exhausted without returning — too many redirects.
    throw new SafeError('This page redirected too many times.');
  } finally {
    clearTimeout(timer);
  }
}

// Stream the response body, aborting if it exceeds MAX_BYTES.
async function readBodyCapped(res: Response): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new SafeError('This page is too large to analyze.');
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// ── Readable-text extraction (no JS execution) ───────────────────────────────

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

interface ParsedHtml {
  title: string;
  text: string;
  metaTitle: string;
  metaDescription: string;
}

function parseHtml(html: string, url: string): ParsedHtml {
  // runScripts is left at its safe default (undefined) — jsdom executes no JS.
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  let title = (doc.title || '').trim();
  let text = '';

  try {
    const article = new Readability(doc).parse();
    if (article) {
      if (article.title) title = article.title.trim();
      text = cleanText(article.textContent ?? '');
    }
  } catch {
    // Readability can throw on malformed DOM — fall through to the body fallback.
  }

  // Fallback: raw body text when Readability yields little/nothing.
  if (text.length < MIN_READABLE_CHARS) {
    const bodyText = cleanText(doc.body?.textContent ?? '');
    if (bodyText.length > text.length) text = bodyText;
  }

  // OpenGraph / meta — the partial fallback when full article text is unavailable
  // (social posts, JS-rendered pages that still ship share metadata).
  const meta = (keys: string[]): string => {
    for (const key of keys) {
      const el = doc.querySelector(`meta[property="${key}"]`) ?? doc.querySelector(`meta[name="${key}"]`);
      const content = el?.getAttribute('content')?.trim();
      if (content) return content;
    }
    return '';
  };
  const metaTitle = meta(['og:title', 'twitter:title']);
  const metaDescription = meta(['og:description', 'twitter:description', 'description']);

  dom.window.close();
  return { title, text, metaTitle, metaDescription };
}

/**
 * Fetch a URL and extract readable content. Never throws.
 * Returns { status: 'success', title, text } or { status: 'failed', error }.
 */
export async function extract(rawUrl: string): Promise<ExtractionResult> {
  try {
    const { html, finalUrl } = await safeFetch(rawUrl);
    const { title, text, metaTitle, metaDescription } = parseHtml(html, finalUrl);

    if (text.length >= MIN_READABLE_CHARS) {
      return { status: 'success', title: title || undefined, text };
    }

    // Phase B — metadata-only (partial) fallback: accept OG/meta preview text when
    // the full article body couldn't be read. Skipped for authwalled social hosts,
    // whose OG tags are typically a generic login wall, not the post itself.
    const metaText = cleanText([metaTitle, metaDescription].filter(Boolean).join('. '));
    if (metaText.length >= MIN_METADATA_CHARS && !isAuthwalledHost(rawUrl)) {
      return { status: 'partial', title: (metaTitle || title) || undefined, text: metaText };
    }

    return {
      status: 'failed',
      error: isAuthwalledHost(rawUrl)
        ? SOCIAL_FAILURE_MSG
        : 'We could not extract enough readable content from this page.',
    };
  } catch (err) {
    const baseError =
      err instanceof SafeError
        ? err.message
        : err instanceof Error && err.name === 'AbortError'
        ? 'The page took too long to respond.'
        : 'We could not read this page.';
    // Tailor authwalled social hosts toward the manual-paste fallback.
    const error = isAuthwalledHost(rawUrl) ? SOCIAL_FAILURE_MSG : baseError;
    console.warn(`[urlExtraction] extraction failed for "${rawUrl}": ${baseError}`);
    return { status: 'failed', error };
  }
}
