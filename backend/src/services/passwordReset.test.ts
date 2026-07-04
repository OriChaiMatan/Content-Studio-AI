import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateResetToken, hashToken, resetExpiry, RESET_TTL_MS, RESET_TTL_MINUTES } from '../lib/passwordReset';
import { renderPasswordResetEmail } from './emailService';

// ── Token primitives ────────────────────────────────────────────────────────

test('generateResetToken: high-entropy URL-safe token whose hash matches; unique per call', () => {
  const a = generateResetToken();
  const b = generateResetToken();
  // base64url alphabet only (no + / =), and long (32 bytes → ~43 chars).
  assert.match(a.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(a.token, b.token);                 // random each time
  assert.notEqual(a.tokenHash, b.tokenHash);
  assert.equal(a.tokenHash, hashToken(a.token));      // stored hash == hash(raw)
  assert.notEqual(a.token, a.tokenHash);              // raw never equals stored value
});

test('hashToken: deterministic SHA-256 hex (64 chars)', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken('abc'), hashToken('abd'));
});

test('resetExpiry: 60 minutes ahead', () => {
  assert.equal(RESET_TTL_MS, 60 * 60 * 1000);
  assert.equal(RESET_TTL_MINUTES, 60);
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(resetExpiry(now).toISOString(), '2026-01-01T01:00:00.000Z');
});

// ── Email template ──────────────────────────────────────────────────────────

test('renderPasswordResetEmail: contains link, button, expiry; escapes the name', () => {
  const url = 'https://app.lumai.com/reset-password?token=AbC-123_xyz';
  const { html, text, subject } = renderPasswordResetEmail({ to: 'u@x.com', name: 'Ada', resetUrl: url, expiresMinutes: 60 });
  assert.equal(subject, 'Reset your LumAI password');
  assert.ok(html.includes(`href="${url}"`), 'button/link points at the reset URL');
  assert.ok(/Reset password/.test(html), 'has a reset button');
  assert.ok(/60 minutes/.test(html) && /60 minutes/.test(text), 'states the expiry');
  assert.ok(html.includes('Hi Ada,'));
  assert.ok(text.includes(url));
  assert.ok(!/undefined|NaN/.test(html));
});

test('renderPasswordResetEmail: HTML-escapes an injected name (no raw markup)', () => {
  const { html } = renderPasswordResetEmail({ to: 'u@x.com', name: '<script>alert(1)</script>', resetUrl: 'https://x/y', expiresMinutes: 60 });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderPasswordResetEmail: empty name falls back to a neutral greeting', () => {
  const { html, text } = renderPasswordResetEmail({ to: 'u@x.com', name: '', resetUrl: 'https://x/y', expiresMinutes: 60 });
  assert.ok(html.includes('Hi there,'));
  assert.ok(text.includes('Hi there,'));
});
