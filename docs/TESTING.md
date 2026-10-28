# Verification

Run `npm ci`, `npm test`, and `npm run build` with Node 24.

Delivery verification on 2026-10-28: **20 tests passed across four files**, TypeScript/production build passed, and `scripts/check-build.mjs` verified generated assets, icons, manifest scope and service worker for both `/` and `/machinebook-pro/`. The production JS bundle was approximately 89 KB gzip, excluding the separate Workbox helper.

Automated tests cover:

- Offline edits preserve the original server revision; repeated edits coalesce.
- Unsynced create/delete cancellation and removal of dependent entries.
- Offline parent/category dependencies remain ordered before child records after repeated edits.
- A simulated DOM app test creates a category/machine/note, remounts from IndexedDB, searches note content, edits the machine and deletes its dependent content. This is not a visual browser test.
- Pending local edits survive a refreshed server snapshot.
- Queued deletions do not resurrect descendants.
- Search across machine, category and attached notes.
- CSV quoting and formula-injection protection.
- Category parent choice cycle prevention.
- IndexedDB account separation and logout removal of metadata/drafts/files.
- The actual SQL migration executes in PGlite (embedded PostgreSQL), using stub Supabase Auth/Storage schemas and real database roles/RLS.
- Company read isolation; viewer write denial; denied role escalation/direct writes; invalid cross-company references; UUID takeover prevention; stale-revision conflicts; category cycle and deletion rules; private Storage role policies; canonical asset paths; cascading deletion; anonymous access denial.

The PGlite test exercises SQL behavior, not the hosted Supabase Storage HTTP service or Auth email delivery. Service integration tests require a real project and two companies with admin/viewer users.

## Manual acceptance checklist after configuration

1. Sign in as an admin. Create a category/subcategory and a machine with all fields. Reload and verify persistence.
2. Add two photos, rename captions, select a cover and zoom. Add an instruction with pictures, reorder steps and print it to PDF.
3. Create/edit/delete a note and a troubleshooting record. Upload/download a PDF and a DXF drawing.
4. Search by model, ID, category and note content. Check filters/sorts and JSON/CSV output.
5. Switch DE/EN/IT and light/dark modes. Verify 360px mobile width, tablet and desktop, keyboard navigation and screen-reader labels.
6. Build/serve production, visit once online and install. Download files for offline use. Disable network, reload, view cached records/files, edit a note and close/reopen a form draft. Reconnect and confirm sync completes.
7. Edit the same note from two browser profiles: the second save must retain its local version and present conflict controls. Test each resolution choice, including a record deleted remotely.
8. Sign in as a viewer: no mutation controls, and direct RPC/storage writes must fail. Another-company user must not be able to read content/files by guessed IDs/paths.
9. Sign out, verify account data cannot be opened offline from the app. Check that unsynced/draft discard requires confirmation.
10. Open `/<repository>/#machine/UUID` directly on GitHub Pages; refresh. Verify the manifest scope and app icons, then installation on iOS and Android.

Browser preview access was denied by the authoring environment's permission gate. No visual/browser or real-device acceptance result is claimed. Hosted auth/storage and GitHub deployment have not been exercised without project credentials/repository details.

Dependency audit at delivery: `npm audit --omit=dev` reported zero vulnerabilities. The full development-tool audit reported four low-severity transitive findings in the Workbox/deepmerge chain; the registry offered no compatible patched deepmerge release. Do not apply the suggested obsolete PWA-plugin downgrade. Review upstream updates before future builds. The earlier vulnerable test dependencies were upgraded before delivery.
