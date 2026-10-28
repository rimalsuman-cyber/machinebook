// Run on a trusted administrator computer. Never use a VITE_ variable for this key.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_DIR } = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !BACKUP_DIR ||
  !path.isAbsolute(BACKUP_DIR)
)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and an absolute BACKUP_DIR outside this repository.",
  );
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(BACKUP_DIR);
const relative = path.relative(repo, target);
if (
  relative === "" ||
  (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
)
  throw new Error("Backup directory must be outside the repository.");
await mkdir(target, { recursive: true });
const output = path.join(
  target,
  "machinebook-" + new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(output, { recursive: false });
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const records = {};
for (const table of ["organizations", "memberships", "items"]) {
  const rows = [];
  for (let page = 0; ; page++) {
    let query = client.from(table).select("*");
    query =
      table === "memberships"
        ? query.order("org_id").order("user_id")
        : query.order("id");
    const { data, error } = await query.range(page * 500, page * 500 + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  records[table] = rows;
}
await writeFile(
  path.join(output, "records.json"),
  JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), ...records },
    null,
    2,
  ),
);
let count = 0;
for (const asset of records.items.filter((i) => i.kind === "asset")) {
  const name = asset.data.path;
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/i.test(name))
    throw new Error(
      "Unexpected storage path. Backup stopped; inspect the record safely.",
    );
  const { data, error } = await client.storage
    .from("machinebook")
    .download(name);
  if (error) throw error;
  const destination = path.join(output, "files", name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, new Uint8Array(await data.arrayBuffer()));
  count++;
}
await writeFile(
  path.join(output, "COMPLETE.txt"),
  `${count} referenced files backed up.\nStore encrypted and restrict access.\n`,
);
console.log(
  `Backup complete: ${count} files and ${records.items.length} records. Output: ${output}`,
);
