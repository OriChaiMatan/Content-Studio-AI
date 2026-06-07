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
  status: 'success' | 'failed';
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
const USER_AGENT = 'ContentStudioAI/1.0 (+source-analysis; no-js)';

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

function extractReadable(html: string, url: string): { title: string; text: string } {
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

  dom.window.close();
  return { title, text };
}

/**
 * Fetch a URL and extract readable content. Never throws.
 * Returns { status: 'success', title, text } or { status: 'failed', error }.
 */
export async function extract(rawUrl: string): Promise<ExtractionResult> {
  try {
    const { html, finalUrl } = await safeFetch(rawUrl);
    const { title, text } = extractReadable(html, finalUrl);

    if (text.length < MIN_READABLE_CHARS) {
      return {
        status: 'failed',
        error: 'We could not extract enough readable content from this page.',
      };
    }

    return { status: 'success', title: title || undefined, text };
  } catch (err) {
    const error =
      err instanceof SafeError
        ? err.message
        : err instanceof Error && err.name === 'AbortError'
        ? 'The page took too long to respond.'
        : 'We could not read this page.';
    console.warn(`[urlExtraction] extraction failed for "${rawUrl}": ${error}`);
    return { status: 'failed', error };
  }
}
