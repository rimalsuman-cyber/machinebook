import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { newItem } from "./model";
const db = new PGlite();
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  viewer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outsider = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const category = {
  ...newItem("category", org),
  data: { name: "Test category" },
};
const machine = {
  ...newItem("machine", org),
  category_id: category.id,
  data: { name: "Test machine" },
};
async function asUser(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
async function save(item: unknown, revision = 0) {
  return db.query("select public.save_item($1::jsonb,$2::integer)", [
    JSON.stringify(item),
    revision,
  ]);
}
beforeAll(async () => {
  await db.exec(
    `create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610280001_machinebook.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users values('${admin}'),('${viewer}'),('${outsider}');insert into public.organizations values('${org}','A'),('${other}','B');insert into public.memberships values('${org}','${admin}','admin'),('${org}','${viewer}','viewer'),('${other}','${outsider}','admin');`,
  );
  await asUser(admin);
  await save(category);
  await save(machine);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL security migration", () => {
  it("allows members to read only their own organization", async () => {
    await asUser(viewer);
    expect((await db.query("select * from public.items")).rows).toHaveLength(2);
    await asUser(outsider);
    expect((await db.query("select * from public.items")).rows).toHaveLength(0);
  });
  it("blocks viewer writes and role escalation", async () => {
    await asUser(viewer);
    await expect(
      save({ ...machine, data: { name: "attack" } }, 1),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      db.exec(`update public.memberships set role='admin'`),
    ).rejects.toThrow("permission denied");
  });
  it("blocks direct writes even for admins", async () => {
    await asUser(admin);
    await expect(db.exec(`update public.items set data='{}'`)).rejects.toThrow(
      "permission denied",
    );
  });
  it("rejects cross-company references and object ID takeover", async () => {
    await asUser(outsider);
    await expect(
      save({
        ...newItem("machine", other),
        category_id: category.id,
        data: { name: "bad" },
      }),
    ).rejects.toThrow("Category required");
    await expect(save({ ...category, org_id: other }, 1)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
  it("detects concurrent updates without losing the winning edit", async () => {
    await asUser(admin);
    await save({ ...machine, data: { name: "Updated" } }, 1);
    await expect(
      save({ ...machine, data: { name: "Stale" } }, 1),
    ).rejects.toThrow("CONFLICT");
    const result = await db.query<{ data: { name: string } }>(
      "select data from public.items where id=$1",
      [machine.id],
    );
    expect(result.rows[0].data.name).toBe("Updated");
  });
  it("prevents category cycles and deletion of categories in use", async () => {
    await asUser(admin);
    const child = {
      ...newItem("category", org, category.id),
      data: { name: "Child" },
    };
    await save(child);
    await expect(save({ ...category, parent_id: child.id }, 1)).rejects.toThrow(
      "Category cycle",
    );
    await expect(
      db.query("select public.delete_item($1,1)", [category.id]),
    ).rejects.toThrow("Category is in use");
  });
  it("enforces private storage read and write roles", async () => {
    await asUser(admin);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('machinebook',$1)",
      [org + "/test"],
    );
    await asUser(viewer);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('machinebook',$1)",
        [org + "/blocked"],
      ),
    ).rejects.toThrow("row-level security");
    await asUser(outsider);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('machinebook',$1)",
        [org + "/attack"],
      ),
    ).rejects.toThrow("row-level security");
  });
  it("requires asset paths to belong to the same company", async () => {
    await asUser(admin);
    await expect(
      save({
        ...newItem("asset", org, machine.id),
        data: { path: other + "/bad", mime: "image/jpeg" },
      }),
    ).rejects.toThrow("Invalid file path");
  });
  it("deletes dependent content and returns file paths for cleanup", async () => {
    await asUser(admin);
    const note = {
      ...newItem("note", org, machine.id),
      data: { title: "Note" },
    };
    await save(note);
    const asset = newItem("asset", org, note.id);
    asset.data = { path: org + "/" + asset.id, mime: "image/jpeg" };
    await save(asset);
    const result = await db.query<{ delete_item: string[] }>(
      "select public.delete_item($1,2)",
      [machine.id],
    );
    expect(result.rows[0].delete_item).toContain(asset.data.path);
    expect(
      (
        await db.query("select * from public.items where parent_id=$1", [
          machine.id,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("denies anonymous database access", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from public.items")).rejects.toThrow(
      "permission denied",
    );
  });
});
