export type Kind = "category" | "machine" | "step" | "note" | "issue" | "asset";
export interface Item {
  id: string;
  org_id: string;
  kind: Kind;
  parent_id: string | null;
  category_id: string | null;
  data: Record<string, string>;
  revision: number;
  updated_at: string;
  created_at: string;
}
export interface Membership {
  org_id: string;
  user_id: string;
  role: "admin" | "viewer";
  name: string;
}
export interface Pending {
  item: Item;
  expected: number;
  deleted?: boolean;
  conflict?: string;
}
export interface Workspace {
  items: Item[];
  pending: Pending[];
}
export const emptyWorkspace = (): Workspace => ({ items: [], pending: [] });
// Parents/categories must reach the server before dependent offline records.
export function orderPending(pending: Pending[]): Pending[] {
  const remaining = [...pending.filter((p) => !p.deleted)];
  const ordered: Pending[] = [];
  while (remaining.length) {
    const index = remaining.findIndex(
      (p) =>
        !remaining.some(
          (other) =>
            other.item.id === p.item.parent_id ||
            other.item.id === p.item.category_id,
        ),
    );
    // Invalid imported/cyclic data is kept for explicit server validation, never dropped.
    if (index < 0) {
      ordered.push(...remaining);
      break;
    }
    ordered.push(...remaining.splice(index, 1));
  }
  return [...ordered, ...pending.filter((p) => p.deleted)];
}
export function newItem(
  kind: Kind,
  org_id: string,
  parent_id: string | null = null,
): Item {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    org_id,
    kind,
    parent_id,
    category_id: null,
    data: {},
    revision: 0,
    created_at: now,
    updated_at: now,
  };
}
export function queueChange(
  state: Workspace,
  item: Item,
  deleted = false,
): Workspace {
  const prior = state.pending.find((p) => p.item.id === item.id);
  const pending = state.pending.filter((p) => p.item.id !== item.id);
  if (!(deleted && (prior?.expected ?? item.revision) === 0))
    pending.push({ item, expected: prior?.expected ?? item.revision, deleted });
  const ids = new Set([item.id]);
  if (deleted) {
    let size;
    do {
      size = ids.size;
      state.items.forEach((i) => {
        if (i.parent_id && ids.has(i.parent_id)) ids.add(i.id);
      });
    } while (size !== ids.size);
  }
  return {
    items: [
      ...state.items.filter((i) => !ids.has(i.id)),
      ...(deleted ? [] : [item]),
    ],
    pending: orderPending(
      pending.filter((p) => p.item.id === item.id || !ids.has(p.item.id)),
    ),
  };
}
export function mergeRemote(remote: Item[], pending: Pending[]): Item[] {
  let state: Workspace = { items: remote, pending: [] };
  pending.forEach((p) => {
    state = queueChange(state, p.item, p.deleted);
  });
  return state.items;
}
export function matches(item: Item, query: string, items: Item[]): boolean {
  const category = items.find((i) => i.id === item.category_id);
  const related = items.filter((i) => i.parent_id === item.id);
  const text = [item, ...related, ...(category ? [category] : [])]
    .flatMap((i) => Object.values(i.data))
    .join(" ")
    .toLocaleLowerCase();
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
export function csv(items: Item[]): string {
  const keys = [
    "name",
    "type",
    "manufacturer",
    "model",
    "serial",
    "identifier",
    "department",
    "location",
    "year",
    "specifications",
    "description",
    "notes",
  ];
  const cell = (value: string) =>
    '"' +
    (/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      keys.join(","),
      ...items
        .filter((i) => i.kind === "machine")
        .map((i) => keys.map((k) => cell(i.data[k] || "")).join(",")),
    ].join("\r\n")
  );
}
export function categoryChoices(items: Item[], editing?: string): Item[] {
  const excluded = new Set(editing ? [editing] : []);
  let before;
  do {
    before = excluded.size;
    items.forEach((i) => {
      if (i.parent_id && excluded.has(i.parent_id)) excluded.add(i.id);
    });
  } while (before !== excluded.size);
  return items.filter((i) => i.kind === "category" && !excluded.has(i.id));
}
