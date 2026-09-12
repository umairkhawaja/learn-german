# Deutsch Meister — PWA

An installable, offline German trainer built around what an A1–B1 course actually
teaches: ~3,800 CEFR-levelled words and 330 everyday chunks, full conjugation,
declension and imperative tables, spaced repetition, and a 32-card A1–B1 grammar
reference. Vite + React, no backend required — all data is bundled and progress is
stored on-device (with optional cloud sync, see below).

## How you practise

| Tab | What it is |
| --- | --- |
| **Mixed** | The landing view. A flashcard deck drawn across nouns, verbs, adjectives and grammar at once, weighted so nouns and verbs carry it. **Review** narrows the deck to the words whose spacing interval has elapsed. |
| **Quiz** | Multiple choice within one word type, in whatever mode that type supports — article, plural, Partizip II, haben/sein, comparative, case effect. Works a chunk of ten words at a time; new words unlock as the chunk is mastered. |
| **Chunks** | Whole Redemittel and Nomen-Verb-Verbindungen, learned as units rather than words (A2+). |
| **Browse** | The whole dataset, searchable, filterable by topic and by learning status (not started / learning / weak / mastered). |
| **Spickzettel** | 32 grammar cards covering A1–B1: cases, Genus hacks, plural patterns, every tense, Konjunktiv II, Passiv, adjective endings, the Satzbau algorithm, Relativsätze, prepositions, Stolperfallen. |
| **Notes** | Your own Notion pages, read live (optional — see the proxy setup below). |
| **Stats** | Mastery by level and by word type, a fortnight of daily practice, your streak and daily goal, and backup/restore. |

Mastery is one shared number: a word answered in Mixed counts in Quiz, Browse and
Stats alike. 4★ retires a word from practice; "Mark as mastered" retires it by hand.

## Working on the data

`public/data/*.json` is the dataset and is fetched at runtime — adding words needs
no rebuild. It is also the part most likely to go quietly wrong, so there is a
validator for the invariants the engine relies on:

```bash
npm run data:check     # also runs automatically before every build
```

It enforces one category per headword (progress is keyed `<category>:<word>`, so a
duplicate is two separate words to the engine), complete example sentences, real
comparatives, correct du/ihr endings, reflexive pronouns present in reflexive
conjugations, and valid level codes.

The one-shot repair scripts that brought the data to that state are kept in
`scripts/` — each reports before it writes and is safe to re-run:

| Script | What it fixed |
| --- | --- |
| `fix-reflexive-verbs.mjs` | 39 reflexive verbs conjugated without their pronoun |
| `fix-verb-conjugations.mjs` | six verbs with wrong endings or a mangled separable prefix |
| `add-imperatives.mjs` | writes `imp` where an imperative genuinely exists |
| `fix-adjectives.mjs` | withdraws blindly generated comparatives; tags non-adjectives |
| `fix-truncated-examples.mjs` | 271 example sentences clipped mid-phrase |
| `fix-phrase-notes.mjs` | English usage notes filed as German examples |
| `dedupe-across-categories.mjs` | 137 headwords living in two or three category files |
| `fix-other-wordclasses.mjs`, `fix-noun-topics.mjs` | topic and word-class buckets |

## Requirements
- Node.js 18+ and npm.

## Run locally (development)
```bash
npm install
npm run dev        # opens a local dev server with hot reload
```

## Build for production
```bash
npm run build      # outputs static site to ./dist
npm run preview    # serve ./dist locally to test the production build
```

## Deploy (any static host, HTTPS required for PWA)
Upload the contents of `dist/` to any of:
- **Cloudflare Pages** / **Netlify** — drag-and-drop `dist/`, or connect the repo (build cmd `npm run build`, output `dist`).
- **GitHub Pages** — push the repo and serve `dist/` (e.g. via an action or the `gh-pages` branch).
  - `base: "./"` is already set, so assets load correctly under a project subpath
    (`username.github.io/deutsch-meister/`) as well as at a domain root.

## Install on iPhone
1. Open the deployed **https** URL in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch from the home-screen icon: full-screen, offline, with its own storage.

## How it works (architecture)
The app is modular — composition lives in `src/App.jsx`, everything else is split out:
- `src/config/` — the **extension cores**:
  - `levels.js` — the CEFR level registry. **Add a level = one row here** + tag data with its code.
  - `categories.jsx` — the word-type registry. **Add a category = one descriptor** + a `public/data/<key>.json`.
  - `theme.js` — colour/font design tokens.
- `src/engine/` — `progress.js` (persistence + spaced-repetition schedule), `quiz.js` (question building, chunk/session/deck pickers, due counts), `activity.js` (daily tally, streak, goal), `useCloudSync.js`, `useDriveSync.js`.
- `src/components/` — `Header`, `BottomNav`, `AppStyles` (the global stylesheet), the views (`Mixed`, `Quiz`, `Chunks`, `Browse`, `Cheatsheet`, `Notes`, `Stats`), the reusable `QuizRunner`, shared `ui` primitives, and `detail` card-backs.
- `public/data/*.json` — the dataset. **Add words here**; tag entries with `lvl:"A2"` etc. (no `lvl` → A1). No rebuild needed — fetched at runtime.
- `src/storage.js` — progress persistence via **IndexedDB** (`idb-keyval`).
- `src/speak.js` — German text-to-speech (Web Speech API).
- `src/backup.js` — export/import progress; uses the iOS **Share sheet** ("Save to Files") with a download fallback.
- `src/driveSync.js` — optional Google Drive sync (see below).
- PWA manifest + service worker are generated by `vite-plugin-pwa` (offline precache, auto-update).

## Notes on iOS storage
iOS may clear an unused PWA's storage after ~7 days. Mitigations are built in:
- IndexedDB + a `navigator.storage.persist()` request on startup.
- Installing to the home screen reduces eviction.
- **Stats → Backup & restore** exports your progress; a "Last backup N days ago" nudge
  appears (amber after a week). Export occasionally and you're safe — restore re-imports it.

## Google Drive sync (cross-device persistence)
Progress can sync to a hidden file in your own Google Drive (`appDataFolder` — not visible
in your normal Drive UI, not shared with anyone). This is implemented in `src/driveSync.js`
using Google Identity Services (OAuth, no client secret needed for static sites) and the
Drive REST API directly via `fetch`.

**One-time setup (you, the developer):**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create a new project
   (or reuse one).
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Add your own Google account as a **test user** (or publish the app — `drive.appdata`
     is a non-sensitive scope and usually doesn't require verification, but test mode is fine
     for personal use).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `https://umairkhawaja.github.io`
     (and `http://localhost:5173` for local dev, if desired).
   - No redirect URIs needed (token-client flow, not redirect flow).
   - Copy the generated **Client ID** (`....apps.googleusercontent.com`).
5. Paste it into `src/driveSync.js`:
   ```js
   const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
   ```
6. Rebuild and deploy (`npm run build`, push `dist/`).

**Using it (the user):**
- Open **Stats → Backup & restore → Connect Google Drive**, sign in, grant the
  "see, create, and delete its own configuration data" permission (this is the
  `drive.appdata` scope — Drive can't see or touch your other files).
- After connecting, the app auto-syncs in the background: it pulls + merges remote
  progress on load, and pushes local progress when you switch tabs or close the app.
- **Sync now** forces an immediate pull-merge-push. **Disconnect** revokes local
  access (does not delete the Drive file).
- Merge strategy: for each word, whichever side (local vs. Drive) has more total
  attempts wins (ties broken by higher mastery) — so two devices can be used
  interchangeably without losing progress.

## Cloud sync (durable, login-free — the primary channel)
Google Drive sync works but has two rough edges: its OAuth token expires roughly
hourly and can't refresh without a fresh sign-in ("keeps disconnecting"), and
because progress ultimately lives in IndexedDB, iOS's ~7-day PWA storage eviction
can wipe local mastery so mastered words reappear in the deck until you reconnect.

Cloud sync fixes both by storing progress on a **Cloudflare Worker + KV** store,
reached with a **secret key baked into the build** — no login, ever, and it
survives storage eviction. On load the app pulls the cloud snapshot, merges it
with local, and pushes back; it also pushes on tab-hide/close. This is now the
primary sync channel; Drive is kept only to import an old snapshot once.

**One-time setup (developer):**
1. Create the KV namespace:
   ```bash
   npx wrangler kv namespace create PROGRESS_KV
   ```
   Copy the printed `id` into `wrangler.toml` (the `kv_namespaces` block).
2. Set the secret key allowlist (comma-separated; one long random string is fine
   for personal use):
   ```bash
   npx wrangler secret put SYNC_KEYS
   ```
3. Deploy the Worker (uses `wrangler.toml`, which targets `worker/progress-sync.js`):
   ```bash
   npx wrangler deploy
   ```
   The existing Notion proxy deploys separately and is unaffected.
4. In `.env.local` (see `.env.example`) set:
   ```
   VITE_SYNC_URL=https://deutschmeister-progress-sync.<subdomain>.workers.dev
   VITE_SYNC_KEY=<one of the keys you put in SYNC_KEYS>
   ```
   Rebuild and deploy the app (`npm run build`, push `dist/`).

**Using it:** nothing to do — when `VITE_SYNC_URL` + `VITE_SYNC_KEY` are set, the
**Stats → Backup & restore** panel shows "☁️ Cloud sync (active)" and syncs
automatically. To bring your existing progress over, connect Google Drive once
under the same panel — it imports the latest Drive snapshot and seeds the cloud
store; after that you can ignore Drive.

**Merge strategy** is shared with Drive: per word, whichever side has more total
attempts wins (ties → higher mastery); the force-mastered `skip` flag is sticky.

**Endpoints** (`worker/progress-sync.js`): `GET /progress` and `PUT /progress`,
both gated by the `X-Sync-Key` header. The KV entry is namespaced by a SHA-256
hash of the key, so the raw secret never appears in a key name.

## Updating
After deploying a new build, the service worker auto-updates the installed app on next launch.
