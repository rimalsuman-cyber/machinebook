import { useCallback, useEffect, useRef, useState } from "react";
import { local } from "./db";
import { fetchItems, saveRemote, deleteRemote } from "./api";
import {
  emptyWorkspace,
  mergeRemote,
  queueChange,
  type Item,
  type Workspace,
} from "./model";
import { demoData } from "./demo";
export function useWorkspace(scope: string, org: string, demo: boolean) {
  const [state, setState] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = useRef(state),
    lock = useRef(false),
    alive = useRef(true);
  const commit = useCallback(
    async (next: Workspace) => {
      await local.write(scope, next);
      current.current = next;
      if (alive.current) setState(next);
    },
    [scope],
  );
  const sync = useCallback(async () => {
    if (demo || !navigator.onLine || lock.current || !alive.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      for (const p of [...current.current.pending]) {
        if (p.conflict) break;
        try {
          const saved = p.deleted
            ? (await deleteRemote(p.item, p.expected), null)
            : await saveRemote(p.item, p.expected, scope);
          const pending = current.current.pending.filter(
            (x) => x.item.id !== p.item.id,
          );
          const items = current.current.items.filter((x) => x.id !== p.item.id);
          await commit({ items: saved ? [...items, saved] : items, pending });
        } catch (e) {
          const message =
            e instanceof Error
              ? e.message
              : String((e as { message?: string }).message || e);
          if (message.includes("CONFLICT"))
            await commit({
              ...current.current,
              pending: current.current.pending.map((x) =>
                x.item.id === p.item.id ? { ...x, conflict: message } : x,
              ),
            });
          throw e;
        }
      }
      const remote = await fetchItems(org);
      await commit({
        items: mergeRemote(remote, current.current.pending),
        pending: current.current.pending,
      });
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : String((e as { message?: string }).message || e),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }, [scope, org, demo, commit]);
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const cached = await local.read(scope);
        await commit(cached || (demo ? demoData() : emptyWorkspace()));
        setReady(true);
        await sync();
      } catch (e) {
        setError(String(e));
      }
    })();
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      alive.current = false;
      window.removeEventListener("online", online);
    };
  }, [scope, demo, commit, sync]);
  async function save(item: Item, deleted = false) {
    if (lock.current)
      throw new Error("Sync in progress. Please try again shortly.");
    lock.current = true;
    try {
      let next = queueChange(
        current.current,
        { ...item, updated_at: new Date().toISOString() },
        deleted,
      );
      if (demo)
        next = {
          items: next.items.map((i) =>
            i.id === item.id ? { ...i, revision: i.revision + 1 } : i,
          ),
          pending: [],
        };
      await commit(next);
    } finally {
      lock.current = false;
    }
    await sync();
  }
  async function resolve(id: string, keep: boolean) {
    if (lock.current) return;
    lock.current = true;
    try {
      const remote = await fetchItems(org);
      const server = remote.find((i) => i.id === id);
      const pending = current.current.pending.flatMap((p) =>
        p.item.id !== id
          ? [p]
          : keep
            ? [{ ...p, expected: server?.revision || 0, conflict: undefined }]
            : [],
      );
      await commit({ items: mergeRemote(remote, pending), pending });
    } finally {
      lock.current = false;
    }
    void sync();
  }
  return { ...state, ready, busy, error, save, sync, resolve };
}
