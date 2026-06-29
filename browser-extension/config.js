// LumAI extension config.
// Defaults to PRODUCTION — this is what ships in the Chrome Web Store package.
// For LOCAL development only: set MODE = 'local' (and ensure manifest.json includes
// the localhost host_permissions — the shipped production package omits them).
// If the production domain changes, update `production.api`/`app` here AND the
// host_permissions in manifest.json to match.
const MODE = 'production'; // 'production' (release default) | 'local' (dev only)

const ENV = {
  production: { api: 'https://app.mrtrk.com', app: 'https://app.mrtrk.com' },
  local:      { api: 'http://localhost:3001', app: 'http://localhost:5173' },
};

export const API_BASE = ENV[MODE].api;
export const APP_BASE = ENV[MODE].app;
