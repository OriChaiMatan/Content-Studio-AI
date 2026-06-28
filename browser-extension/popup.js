import { API_BASE, APP_BASE } from './config.js';

// The LumAI session cookie (matches AUTH_COOKIE in backend/src/lib/auth.ts). The
// web app sets it on login (httpOnly, sameSite=lax). We read it via chrome.cookies
// and forward it as a Bearer token because a lax cookie isn't sent on cross-origin
// extension fetches. The token is read fresh each time — never stored.
const AUTH_COOKIE = 'cs_token';

const STATES = ['loading', 'unauth', 'no-cases', 'no-tab', 'ready', 'saving', 'success', 'error'];
const $ = (id) => document.getElementById(id);

let currentTab = null; // { title, url }

function show(state, opts = {}) {
  for (const s of STATES) $(`state-${s}`).classList.toggle('hidden', s !== state);
  if (state === 'loading' && opts.text) $('loading-text').textContent = opts.text;
  if (state === 'error') $('error-text').textContent = opts.text || 'Something went wrong.';
}

// ── Active tab ────────────────────────────────────────────────────────────────
async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || /^(chrome|edge|about|chrome-extension|file):/i.test(tab.url)) return null;
  return { title: (tab.title || tab.url).trim(), url: tab.url };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getToken() {
  try {
    const cookie = await chrome.cookies.get({ url: API_BASE, name: AUTH_COOKIE });
    return cookie?.value || null;
  } catch {
    return null; // missing cookies permission / host permission
  }
}

async function api(path, options = {}) {
  const token = await getToken();
  if (!token) return { status: 401, data: null };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty/non-JSON body */ }
  return { status: res.status, data };
}

// ── Flow ──────────────────────────────────────────────────────────────────────
async function loadCases() {
  show('loading', { text: 'Loading your cases…' });
  let result;
  try {
    result = await api('/api/cases');
  } catch {
    return show('error', { text: 'Cannot reach LumAI. Is the server running?' });
  }
  if (result.status === 401) return show('unauth');
  if (result.status !== 200 || !result.data) return show('error', { text: 'Failed to load cases.' });

  const cases = Array.isArray(result.data.cases) ? result.data.cases : [];
  if (cases.length === 0) return show('no-cases');

  const select = $('case-select');
  select.innerHTML = '';
  for (const c of cases) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title || '(untitled case)';
    select.appendChild(opt);
  }
  show('ready');
}

async function save() {
  const caseId = $('case-select').value;
  if (!caseId || !currentTab) return;
  show('saving');
  let result;
  try {
    result = await api(`/api/cases/${caseId}/sources`, {
      method: 'POST',
      body: JSON.stringify({ type: 'url', label: currentTab.title, content: currentTab.url }),
    });
  } catch {
    return show('error', { text: 'Cannot reach LumAI. Is the server running?' });
  }
  if (result.status === 201) return show('success');
  if (result.status === 401) return show('unauth');
  if (result.status === 409) return show('error', { text: 'This source already exists in that case.' });
  if (result.status === 404) return show('error', { text: 'That case no longer exists.' });
  const msg = result.data?.error || 'Could not save the source.';
  show('error', { text: msg });
}

async function init() {
  show('loading', { text: 'Reading this page…' });
  currentTab = await readActiveTab();
  if (!currentTab) return show('no-tab');

  $('page-title').textContent = currentTab.title;
  $('page-url').textContent = currentTab.url;

  const token = await getToken();
  if (!token) return show('unauth');
  await loadCases();
}

// ── Wiring ────────────────────────────────────────────────────────────────────
$('btn-login').addEventListener('click', () => chrome.tabs.create({ url: `${APP_BASE}/` }));
$('btn-open-app').addEventListener('click', () => chrome.tabs.create({ url: `${APP_BASE}/` }));
$('btn-recheck').addEventListener('click', init);
$('btn-retry').addEventListener('click', init);
$('btn-save').addEventListener('click', save);
$('btn-done').addEventListener('click', () => window.close());

init();
