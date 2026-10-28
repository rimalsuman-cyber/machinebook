import { openDB } from "idb";
import type { Workspace, Item } from "./model";
const db = openDB("machinebook-pro-v1", 1, {
  upgrade(db) {
    db.createObjectStore("state");
    db.createObjectStore("blobs");
    db.createObjectStore("drafts");
  },
});
export const local = {
  async read(scope: string): Promise<Workspace | undefined> {
    return (await db).get("state", scope);
  },
  async write(scope: string, value: Workspace) {
    await (await db).put("state", value, scope);
  },
  async blob(scope: string, id: string): Promise<Blob | undefined> {
    return (await db).get("blobs", scope + ":" + id);
  },
  async putBlob(scope: string, id: string, blob: Blob) {
    await (await db).put("blobs", blob, scope + ":" + id);
  },
  async draft(scope: string, id: string): Promise<Item | undefined> {
    return (await db).get("drafts", scope + ":" + id);
  },
  async saveDraft(scope: string, item: Item) {
    await (await db).put("drafts", item, scope + ":" + item.id);
  },
  async removeDraft(scope: string, id: string) {
    await (await db).delete("drafts", scope + ":" + id);
  },
  async drafts(scope: string): Promise<Item[]> {
    const d = await db;
    const keys = await d.getAllKeys("drafts");
    return Promise.all(
      keys
        .filter((k) => String(k).startsWith(scope + ":"))
        .map((k) => d.get("drafts", k)),
    );
  },
  async clearUser(user: string) {
    const d = await db;
    for (const store of ["state", "blobs", "drafts"] as const) {
      const tx = d.transaction(store, "readwrite");
      for (const key of await tx.store.getAllKeys())
        if (String(key).startsWith(user + ":")) await tx.store.delete(key);
      await tx.done;
    }
  },
};
