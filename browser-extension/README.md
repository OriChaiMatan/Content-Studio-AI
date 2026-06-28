# LumAI — Save Source (Chrome Extension, MVP)

Saves the current page (title + URL) as a `url` source into one of your existing
LumAI content cases. No build step — load it unpacked.

## What it does
- Reads the active tab's title + URL (`activeTab`).
- Reuses your LumAI login: reads the existing `cs_token` session cookie via
  `chrome.cookies` and forwards it as `Authorization: Bearer <jwt>` to the API
  (the `sameSite=lax` cookie can't be sent on cross-origin extension requests).
- Calls the existing backend APIs only — `GET /api/cases` and
  `POST /api/cases/:id/sources`. No content generation, scraping, or DB changes.

## Configure the environment
Edit `config.js` → `MODE`:
- `'local'` → API `http://localhost:3001`, web app `http://localhost:5173`
- `'production'` → `https://app.mrtrk.com`

If your production domain differs, update both `config.js` and the
`host_permissions` in `manifest.json`.

## Backend requirement (already applied in this repo)
Two minimal, additive backend changes make this work (web app unaffected):
- `requireAuth` accepts the same JWT via `Authorization: Bearer` (not just the cookie).
- CORS allows `chrome-extension://` origins.

## Load it in Chrome
1. Make sure the LumAI backend (and, in `local`, the web app) is running.
2. Chrome → `chrome://extensions` → enable **Developer mode** (top-right).
3. **Load unpacked** → select this `browser-extension/` folder.
4. (Optional) pin the extension from the puzzle-piece menu.

## Manual test
1. Log in to LumAI in the browser (web app) so the session cookie exists.
2. Open any normal web article page.
3. Click the LumAI extension icon → the popup shows the page title + URL.
   - If not logged in: **Open LumAI Login**, sign in, return, **retry**.
4. Pick a **Case** from the dropdown.
5. Click **Save** → "Source added successfully."
6. Open that case in LumAI and confirm the URL source appears.

## Notes / limitations (MVP scope)
- URL + title only (no full-content scraping, selected text, PDF, or case creation).
- Token is read fresh per popup; nothing is persisted (no passwords/keys stored).
- After updating `config.js` or `manifest.json`, click **Reload** on the extension card.
- Icons are omitted (Chrome shows a default); add `action.default_icon` + PNGs later.
