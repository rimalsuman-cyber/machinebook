# Backup and recovery

Use an encrypted destination outside the source repository. Limit access to authorized administrators. Exports contain workplace information even though the application source does not.

## Metadata and referenced files

1. Use Settings → Sync and resolve conflicts. Keep the team from editing during a coordinated backup if you need a consistent snapshot.
2. On a trusted administrator computer, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and an absolute `BACKUP_DIR` in the process environment. Do not use frontend `VITE_` variables. Obtain the service-role key only from your own project's settings and keep it out of shell history and source files.
3. Run `node scripts/backup.mjs`. It paginates company, membership and item records, downloads each referenced Storage object, and writes a timestamped folder. Only a folder with `COMPLETE.txt` is a completed backup. A failure leaves a partial folder for diagnosis and exits nonzero; do not count it as complete.
4. Clear the secret from the process environment after use. Encrypt/archive the backup using your organization's tools; apply retention policies and perform restore drills.

The script exports all companies accessible to the service role, not just one user's workspace. It does not export passwords/authentication records, platform configuration or orphan files. For disaster recovery also maintain a supported Supabase database backup and a documented account recreation/recovery process. Supabase database backups do not contain Storage object bytes; keep the separate files backup.

## Restore process

1. Test in a new non-production Supabase project first. Apply the migration and recreate required Auth users or restore Auth through your supported database recovery procedure.
2. If user UUIDs change, explicitly map the old membership user IDs to the new Auth user IDs. Never import an unknown user-to-role mapping blindly.
3. Restore `organizations`, then `memberships`, then `items` through trusted SQL/admin tools. Preserve record IDs and references. Load root categories first, their descendants next, machines next, then notes/steps/issues and assets; or use a transaction with an appropriately reviewed full database restore. Do not use browser mutation RPCs for a bulk database restore.
4. Upload file bytes to the private `machinebook` bucket at their original `orgUUID/assetUUID` paths using `data.mime` as the content type.
5. Validate counts, sample downloads and role isolation with both an administrator and a viewer from each company. Verify no bucket was made public.
6. Reconfigure the frontend project URL/public key only after the restored environment passes acceptance checks.

UI JSON/CSV exports are convenient reports, not a full disaster-recovery backup. PDF export uses your browser's print dialog. To export a full machine handbook, print Overview and each relevant content tab; instructions print as an ordered illustrated page.
