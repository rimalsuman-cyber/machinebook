# MachineBook Pro

A mobile-first industrial machine handbook built with React, TypeScript, Vite, Tailwind CSS, Lucide, Supabase and IndexedDB. German is the default UI language; English and Italian are included. Only fictional demo records are included in source.

## Start locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL. Choose **Lokale Demo öffnen** to try the complete local workflow without a backend. Demo data lives only in this browser's IndexedDB, in a separate namespace from company records. It never synchronizes to Supabase. Add a category, add a machine, then open the machine to add files and knowledge entries.

For company mode, copy `.env.example` to `.env` and fill in the Supabase URL and **publishable / anon** key. Restart the dev server. Never put a service-role or secret key in a `VITE_` variable: these variables are bundled into public frontend JavaScript.

```sh
npm test
npm run build
npm run preview
```

## Features

- Dashboard with counts, recent machines and notes; category cards and optional cover images.
- Unlimited category trees. Category moves prevent cycles; populated categories cannot be deleted until their machines/subcategories are moved.
- Machine create/edit/delete: name, category, type, brand, model, serial, asset ID, department, location, year, specifications, description and additional notes.
- Camera/file uploads, multiple photos, JPEG compression up to 1920px, captions, zoom, cover selection and deletion. Use JPEG/PNG/WebP; convert HEIC first if your browser does not provide JPEG capture.
- Illustrated, reorderable instruction steps; dated notes; troubleshooting records with cause, solution and photos. Use photo captions for “Before” and “After”.
- Private PDF, TXT, CSV, DXF and image storage. Downloads require authenticated membership. Files up to 20 MB each.
- Search machine names, manufacturers, models, category names, IDs, descriptions and attached knowledge entries. Filter by category; sort by name or update time.
- Administrator and read-only viewer roles, with shared company workspaces and optional multi-company membership.
- Light/dark modes, mobile bottom navigation, keyboard-accessible forms and dialogs.
- Offline record snapshots, auto-saved form drafts, queued edits, revision conflict resolution and cached files.
- JSON/CSV export; print the current machine tab or save it as PDF using the browser print dialog. Print instructions by opening the Instructions tab first.
- Installable PWA with offline application shell; repository-safe hash navigation and GitHub Pages base paths.

## Set up Supabase

1. Create a Supabase project in your approved region.
2. Run `supabase/migrations/202610280001_machinebook.sql` once in the Supabase SQL editor, or use the Supabase CLI migration workflow with `supabase db push` after linking your project. The migration creates the company/membership tables, content table, RPCs, private bucket and RLS policies.
3. In **Authentication → Users**, create your administrator account with email/password (or invite the user and complete account setup through your managed auth flow). This app uses email/password sign-in, not self-service signup or invitation redemption. The Supabase administrator manages account creation and password recovery. Disable public signup if it is not needed.
4. Copy that user's UUID and create a company and membership through the SQL editor. Replace the placeholder before running:

```sql
with company as (
  insert into public.organizations(name)
  values ('Your company name') returning id
)
insert into public.memberships(org_id,user_id,role)
select id,'REPLACE_WITH_AUTH_USER_UUID'::uuid,'admin' from company;
```

5. Create additional auth users and grant access with the appropriate role:

```sql
insert into public.memberships(org_id,user_id,role)
values ('COMPANY_UUID'::uuid,'AUTH_USER_UUID'::uuid,'viewer');
-- Use 'admin' for colleagues who may create, edit, delete and upload.
```

6. Set `.env` from `.env.example`. Configure Auth's Site URL to your deployed URL and allow that URL and your local development URL as redirect URLs if you use invitation/recovery flows outside this app.
7. Sign in. A real company starts empty: demo data is never inserted into its database.

Only trusted Supabase administrators can add/remove memberships or change roles. There is intentionally no client-side role assignment. Removing a membership blocks subsequent server access; it cannot remotely erase files already cached/exported on an offline device. See `docs/SECURITY.md`.

## Daily use

1. Add categories from Overview. Edit a saved category to add its card photo or change its parent.
2. Add a machine and assign a category. Save the record, then open Photo Gallery to add its main/additional images. The image icon under a photo selects the cover.
3. Open Instructions and add a step with a title and explanation. After saving, attach one or more pictures to it. Arrow buttons reorder steps.
4. Add dated Notes or Troubleshooting entries; attach photos after saving. Upload PDF/manuals in Documents. Downloads open through your device's file viewer.
5. Settings contains language/theme, synchronization, offline file download, exports, installation help and recoverable form drafts.

All form changes are saved to IndexedDB as drafts. Closing a form keeps its draft; resume it under Settings. Successful Save removes that form draft after the change is safely stored in the local queue. The pending indicator remains until the server acknowledges the change. Never clear browser site data before syncing or exporting needed drafts.

## Offline and conflicts

- First visit/sign-in and initial synchronization require connectivity. Install/open the production build once online so its service worker can cache the app shell. The development server does not enable offline service workers.
- The last synchronized metadata is cached per user and company. Opened photos/documents are cached as blobs. **Download files for offline use** in Settings preloads all referenced files, subject to device storage limits. The browser may evict data under storage pressure; local caching is not a backup.
- Notes and other records can be created/edited offline. Pending mutations replay in order when connectivity returns, on the next launch, or when Sync is pressed. The app must be open for synchronization; no background sync guarantee is assumed on iOS.
- Each mutation carries the server revision it was based on. A mismatch stops the queue, retains the local version and presents conflict controls. **Use server version** discards that queued edit; **Use local version** explicitly retries against the latest revision. If the server deleted the item, keeping the local version attempts to recreate it; a missing parent/category must be restored or reassigned first. Export drafts before discarding any work you may need.
- Concurrent edits to different fields of the same record are not automatically merged. Reordering steps is a series of revision-checked saves, so a concurrent reorder may require conflict resolution.
- Use one active app tab per browser profile while editing offline. Separate browser profiles/devices have independent queues and reconcile through server revision checks.
- Sign-out deletes that account's IndexedDB metadata, drafts and cached files on this browser. It warns before discarding pending work. Demo remains a separate local sandbox.

## Deploy to GitHub Pages

1. Create a GitHub repository. Copy the contents of this project into its root (the root should contain `package.json`). Keep `.env`, uploads, exports and backups outside version control. A private source repository is supported where your GitHub plan allows Pages.
2. Commit source and `package-lock.json`, push to `main`. Never commit real machine data, photos or manuals. `.gitignore` excludes common sensitive/generated directories; it is not a substitute for reviewing staged files.
3. Repository **Settings → Pages → Source → GitHub Actions**.
4. Repository **Settings → Secrets and variables → Actions**:
   - Variable `VITE_SUPABASE_URL`: your project URL.
   - Secret `VITE_SUPABASE_ANON_KEY`: your public publishable/anon key. It is still public in the compiled site; RLS provides security.
   - Optional variable `VITE_BASE_PATH`: `/` for a custom domain. Otherwise the workflow derives `/repository-name/` or `/` for an account Pages repository.
5. Run the included **Test and deploy GitHub Pages** workflow or push a commit. It installs locked dependencies, runs tests, builds and deploys `dist`.
6. Add the deployed HTTPS URL to your Supabase Auth configuration. Sign in and verify your company data and private uploads with an admin and a viewer account.

For a manual project-path build, set `VITE_BASE_PATH=/repository-name/` in `.env` before `npm run build`. Machine links use `#machine/UUID` so refreshes do not require server route rewriting. The PWA manifest, service worker scope and asset paths all follow the base path. Public frontend source is expected; workplace content is fetched from Supabase after authentication and is not in `dist`.

### Install on mobile

- **iPhone/iPad:** open the HTTPS site in Safari, Share → Add to Home Screen.
- **Android:** open in Chrome, browser menu → Install app / Add to Home screen.
- **Desktop:** use the browser's install icon/menu when available.
- An app update can be activated under Settings after the browser downloads it. Finish saving work first.

## Backups and restore

Read `docs/BACKUP.md`. UI JSON export includes records and private object paths, not file bytes or auth users. A backup script is included for trusted administrators to export metadata plus referenced file bytes to a directory outside this repository. Database backups alone do **not** back up Storage file contents.

## Project structure

```text
src/App.tsx                  navigation, auth, dashboard and machine screens
src/components.tsx           forms, autosaved drafts, attachments and image views
src/useWorkspace.ts          durable mutation queue and conflict handling
src/model.ts                 records, search, CSV and local merge rules
src/api.ts                   Supabase and private file access, image compression
src/db.ts                    scoped IndexedDB records, drafts and file cache
src/i18n.ts                  German / English / Italian UI dictionary
src/demo.ts                  optional fictional local-only dataset
src/*.test.ts                persistence, search, exports and SQL security tests
supabase/migrations/         schema, validation RPCs and RLS
scripts/backup.mjs           trusted-admin backup utility
.github/workflows/pages.yml  CI and GitHub Pages deployment
```

The unified `items` table uses discriminated kinds, parent/category foreign keys and JSON text fields. All application mutations pass through validating RPCs with revision checks and tenant membership validation. Table writes and role changes are denied to browser clients. New UI languages can be added to `src/i18n.ts` without changing stored user content.

## Verification and remaining deployment checks

See `docs/TESTING.md` for executed checks and a manual acceptance checklist. The project builds and its automated tests run locally. A live Supabase project, real-device camera/install behavior and production sign-in/upload require your configured deployment; no account or company credentials were supplied here. Browser preview access was denied in the authoring environment, so visual browser QA was not performed.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private storage policies](https://supabase.com/docs/guides/storage/security/access-control), [Vite GitHub Pages deployment](https://vite.dev/guide/static-deploy), [Vite PWA](https://vite-pwa-org.netlify.app/guide/).
