# Security model

## Trust boundaries

- Every record belongs to one organization. Supabase Auth identifies the user; `memberships` determines access. Organization and membership creation is a trusted SQL/admin operation.
- Administrators can mutate their organization's records and files. Viewers can read and export them. Export rights are not separate from read access.
- RLS denies anonymous access and cross-company reads. Browser clients have SELECT only on content tables. Security-definer mutation functions check `auth.uid()` membership, roles, same-company references, category cycles and revisions before writing. Their search path is empty and all relation names are qualified.
- Private Storage access checks membership from the organization UUID in the object path. Viewer writes and other-company access are denied. `save_item` validates canonical asset paths. Files are retrieved using authenticated downloads; no permanent public file URLs are generated.
- Secrets, service-role keys and backups must never enter the frontend bundle/repository. The anon/publishable key is public by design.
- No analytics or third-party image sources are included. Demo data is fictional and client-local.

## Device storage

Offline support intentionally stores machine data and opened files on the device. This cache is **not application-level encrypted**. Use managed devices, OS encryption, screen locks and a dedicated browser profile. Do not use shared browsers for confidential content unless users sign out afterward. Sign-out removes the current account's caches and drafts; browser service-worker caches contain only the public app shell. Revoking membership prevents online access, but cannot revoke files already exported or downloaded to a device or shown offline. The browser may remove local data; synchronize and back up regularly.

## Files and deletions

Machine/entry deletion cascades metadata and returns private file paths for client-side removal. A network failure during removal can leave inaccessible-from-the-app orphan objects in the same private bucket. A failed upload/save can also leave an orphan. Audit Storage against `items` asset paths periodically with an administrator account; delete only verified unreferenced objects after your retention period. The UI download/export features do not include orphans.

Photo compression strips the original container metadata by drawing to a canvas and encoding JPEG. Server file restrictions enforce a 20 MB limit and accepted MIME types. MIME checks do not constitute malware scanning; use your company's document screening process. Documents are downloaded rather than embedded as arbitrary HTML. React escapes user text.

## Hosting and operations

GitHub Pages serves the public app shell; Supabase holds workplace data. HTTPS is required for PWA installation and camera support. Set a custom domain to `/` base path. Consider an organization-approved hosting provider that supports response security headers if you require a strict Content Security Policy, additional audit logging or device access controls. Authentication administration/password recovery is handled outside this app by the Supabase project administrator.

Do not treat draft instructions as approved safety procedures. The app displays a warning on each machine page and printed instructions. Define your own review/approval process for operating procedures.
