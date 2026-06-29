# Approval-Day Checklist — LumAI Browser Extension

What to do **once Google approves** the extension and Chrome assigns the two values
we don't have yet:

- **`<FINAL_EXTENSION_ID>`** — the 32-char ID Chrome assigns (Developer Dashboard → your item → "Public key" / shown in the item URL).
- **`<CHROME_STORE_URL>`** — the public listing URL, e.g. `https://chromewebstore.google.com/detail/<slug>/<FINAL_EXTENSION_ID>`.

> Docs only. Nothing here is implemented yet. Phase A/B/C stay deferred until explicitly requested.
> Fill the two placeholders below first, then work top-down.

```
FINAL_EXTENSION_ID = ____________________________________
CHROME_STORE_URL   = ____________________________________
```

---

## 1. Backend CORS — lock to the final extension ID

- **File:** [`backend/src/app.ts`](src/app.ts) — CORS block, lines ~24–51.
- **Current TODO:** lines ~33–37 (`TODO (after Chrome Web Store upload — locking to the final extension ID)`).
- **Current behavior:** `allowAnyExtension(o)` (line ~38) permits **any** `chrome-extension://` origin so the unpublished/dev extension can call the API before its ID is known.

**Do this:**

1. **Add the ID to the `CORS_ORIGIN` env var** (this is the intended home — do **not** hard-code it in `app.ts`). `CORS_ORIGIN` is read at line ~25 and is comma-separated. Append:
   ```
   chrome-extension://<FINAL_EXTENSION_ID>
   ```
   (See §4 for the exact Railway value.)
2. **`allowAnyExtension` — keep temporarily, then remove.** Leave it in place until you've confirmed the published extension (with its final ID) works against production. Once verified, **delete the `allowAnyExtension` line and the `|| allowAnyExtension(origin)` check** (line ~43) so the `CORS_ORIGIN` allowlist is the single source of truth and no arbitrary extension can hit the API. Remove the TODO comment in the same edit.
3. Backend change requires a **redeploy** (see §4/§5).

---

## 2. Frontend Settings card — real install flow (Phase A)

- **Component:** `BrowserExtensionCard` in [`src/features/settings/SettingsPage.tsx`](src/features/settings/SettingsPage.tsx) (lines ~223–293).
- **Current Install behavior:** the **Install Extension** button (line ~254) calls `setShowInfo(true)`, opening an info modal (lines ~264–290) that says *"available for local testing… Production installation will be available soon."*

**Do this (Phase A — frontend only, no backend, no DB):**

1. Add a constant near the top of the file:
   ```ts
   const CHROME_STORE_URL = '<CHROME_STORE_URL>';
   ```
2. Replace the button's `onClick={() => setShowInfo(true)}` with:
   ```ts
   onClick={() => window.open(CHROME_STORE_URL, '_blank', 'noopener,noreferrer')}
   ```
3. **Retire the info modal** — remove the `showInfo` state + the modal JSX (lines ~264–290), or repurpose it as a short "How it works" guide. Don't leave a dead modal.
4. **Label/status changes:**
   - Badge **"Local MVP"** (amber, lines ~238–241) → **"Available"** (e.g. a neutral/green pill).
   - `DetailRow` **Status** value (line ~251) `"Local testing"` → `"Available"`.
   - Keep the `Browser: Chrome` and `Capture: Current page URL + title` rows as-is.
5. This is a frontend build only — no extension re-upload, no Chrome re-review.

---

## 3. Extension detection — FUTURE PHASE (document only, do NOT implement)

Only if/when we decide the Installed/Connected states are worth a **second Chrome review**
(the current popup-only build has no background worker or `externally_connectable`):

- **`EXTENSION_ID` constant (frontend):** add alongside `CHROME_STORE_URL` once known; used by a detection hook to `chrome.runtime.sendMessage(EXTENSION_ID, { type: 'LUMAI_PING' }, …)`. Guard with `window.chrome?.runtime?.sendMessage` (Chromium only; Firefox/Safari → fall back to "Available", never a false "not installed").
- **`externally_connectable` (extension `manifest.json`):** add
  `"externally_connectable": { "matches": ["https://app.mrtrk.com/*"] }` so only the LumAI web app can ping it.
- **Background service worker (new file):** add `"background": { "service_worker": "background.js" }` — the current extension has none, so this is a new file + a **new version upload + re-review**.
- **`onMessageExternal` ping handler:** in the SW, listen for the ping, validate `sender.origin`/`sender.url` against the allowlist, respond with **safe metadata only** — `{ installed: true, version, capabilities: ['url+title'] }`.
- **Security rules (must hold):**
  - Never return `cs_token`, cookie values, or any secret over the external channel.
  - Read-only channel — no privileged actions (save/fetch/getCookie) exposed externally.
  - "Connected" is derivable as `installed && active web session` — no need to report auth from the extension, and **no DB storage of extension state**.

---

## 4. Railway env vars

- **Service:** backend (API). **Var:** `CORS_ORIGIN` (comma-separated; consumed at [`backend/src/app.ts`](src/app.ts) line ~25).
- **Set it to** (the production web origin **plus** the extension ID):
  ```
  https://app.mrtrk.com,chrome-extension://<FINAL_EXTENSION_ID>
  ```
  Adjust if the current value already lists other allowed origins — append, don't clobber.
- Saving env vars triggers a redeploy on Railway; confirm the new deploy is live before testing.

---

## 5. What to deploy

- **Phase A (Settings card):** frontend change → run the frontend build and deploy the web app (single-origin: the backend serves the SPA, so this ships with the backend image / build output).
- **CORS env change:** redeploy/restart the **backend** so the new `CORS_ORIGIN` is picked up.
- **`allowAnyExtension` removal (after verification):** backend code change → another backend deploy.
- **Phase B/C (detection):** extension re-zip + **re-upload to Chrome Web Store** + wait for review. Not part of approval day.

---

## 6. Manual tests after deploy

1. **Store link:** Settings → Integrations → **Install Extension** opens the correct Chrome Web Store listing in a new tab. Badge reads **Available**.
2. **Install from store**, then in the popup: log in to LumAI, confirm **Save source** on a normal page returns success (201) and the source appears in the chosen case.
3. **CORS sanity:** with the published extension (final ID), confirm `GET /api/cases` and `POST /api/cases/:id/sources` succeed (no CORS error in the extension's devtools console).
4. **Auth edge cases:** logged-out → popup shows "Connect to LumAI"; unsupported page (`chrome://`, etc.) → "Open a normal web page".
5. **After removing `allowAnyExtension`:** re-run tests 2–3 to confirm the final-ID allowlist alone still works (i.e., nothing depended on the temporary any-extension allowance).

---

## Quick reference — where each value goes

| Value | Goes into | Location |
|---|---|---|
| `<FINAL_EXTENSION_ID>` | `CORS_ORIGIN` env var (as `chrome-extension://<ID>`) | Railway → backend service |
| `<FINAL_EXTENSION_ID>` | `EXTENSION_ID` constant (**Phase B only**) | `src/features/settings/SettingsPage.tsx` |
| `<CHROME_STORE_URL>` | `CHROME_STORE_URL` constant (**Phase A**) | `src/features/settings/SettingsPage.tsx` |
| — | remove `allowAnyExtension` after verification | `backend/src/app.ts` (~line 38, 43) |
