// LumAI extension config. Flip MODE to switch environments, then reload the
// unpacked extension. `api` is where the backend lives; `app` is where the user
// logs in (in dev these differ: API on :3001, the web app on :5173). If you change
// the production domain, update `production.api`/`app` AND host_permissions in
// manifest.json to match.
const MODE = 'local'; // 'local' | 'production'

const ENV = {
  local:      { api: 'http://localhost:3001', app: 'http://localhost:5173' },
  production: { api: 'https://app.mrtrk.com', app: 'https://app.mrtrk.com' },
};

export const API_BASE = ENV[MODE].api;
export const APP_BASE = ENV[MODE].app;
