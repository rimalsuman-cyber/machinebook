import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { local } from "./db";
import { newItem } from "./model";
it("isolates account caches and clears records, drafts and files on logout", async () => {
  const item = newItem("note", "org");
  await local.write("alice:org", { items: [item], pending: [] });
  await local.write("bob:org", { items: [item], pending: [] });
  await local.saveDraft("alice:org", item);
  await local.putBlob("alice:org", item.id, new Blob(["private"]));
  expect((await local.drafts("alice:org")).length).toBe(1);
  expect(await local.read("bob:other")).toBeUndefined();
  await local.clearUser("alice");
  expect(await local.read("alice:org")).toBeUndefined();
  expect(await local.blob("alice:org", item.id)).toBeUndefined();
  expect(await local.drafts("alice:org")).toEqual([]);
  expect(await local.read("bob:org")).toBeDefined();
});
