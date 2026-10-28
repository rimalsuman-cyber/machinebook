import { describe, it, expect } from "vitest";
import {
  categoryChoices,
  csv,
  matches,
  mergeRemote,
  newItem,
  queueChange,
} from "./model";
describe("offline data integrity", () => {
  it("orders offline parents and categories before their dependent creations even after re-editing", () => {
    const category = newItem("category", "o");
    const machine = { ...newItem("machine", "o"), category_id: category.id };
    const note = newItem("note", "o", machine.id);
    let state = queueChange({ items: [], pending: [] }, category);
    state = queueChange(state, machine);
    state = queueChange(state, note);
    state = queueChange(state, { ...category, data: { name: "Renamed" } });
    state = queueChange(state, { ...machine, data: { name: "Edited" } });
    expect(state.pending.map((p) => p.item.id)).toEqual([
      category.id,
      machine.id,
      note.id,
    ]);
  });
  it("retains the original server revision through repeated offline edits", () => {
    const machine = {
      ...newItem("machine", "o"),
      revision: 7,
      data: { name: "First" },
    };
    let state = queueChange(
      { items: [machine], pending: [] },
      { ...machine, data: { name: "Second" } },
    );
    state = queueChange(state, { ...machine, data: { name: "Third" } });
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].expected).toBe(7);
    expect(state.items[0].data.name).toBe("Third");
  });
  it("cancels an unsynced creation and its dependent drafts on deletion", () => {
    const machine = newItem("machine", "o");
    const note = newItem("note", "o", machine.id);
    let state = queueChange({ items: [], pending: [] }, machine);
    state = queueChange(state, note);
    state = queueChange(state, machine, true);
    expect(state.items).toEqual([]);
    expect(state.pending).toEqual([]);
  });
  it("preserves local changes over a new remote snapshot", () => {
    const item = {
      ...newItem("note", "o"),
      revision: 1,
      data: { title: "remote" },
    };
    expect(
      mergeRemote(
        [item],
        [{ item: { ...item, data: { title: "local" } }, expected: 1 }],
      )[0].data.title,
    ).toBe("local");
  });
  it("does not resurrect descendants of a queued deletion", () => {
    const machine = { ...newItem("machine", "o"), revision: 1 };
    const note = newItem("note", "o", machine.id);
    expect(
      mergeRemote(
        [machine, note],
        [{ item: machine, expected: 1, deleted: true }],
      ),
    ).toEqual([]);
  });
});
describe("search and export", () => {
  it("finds machines through category and attached note text", () => {
    const cat = { ...newItem("category", "o"), data: { name: "Milling" } };
    const machine = {
      ...newItem("machine", "o"),
      category_id: cat.id,
      data: { name: "Alpha", model: "X1" },
    };
    const note = {
      ...newItem("note", "o", machine.id),
      data: { body: "Coolant filter" },
    };
    expect(matches(machine, "milling coolant", [cat, machine, note])).toBe(
      true,
    );
    expect(matches(machine, "lathe", [cat, machine, note])).toBe(false);
  });
  it("escapes CSV and neutralizes spreadsheet formula injection", () => {
    const item = {
      ...newItem("machine", "o"),
      data: { name: '=HYPERLINK("bad")', description: "a,b\nc" },
    };
    const result = csv([item]);
    expect(result).toContain('"\'=HYPERLINK(""bad"")"');
    expect(result).toContain('"a,b\nc"');
  });
  it("excludes all descendants from parent choices to prevent cycles", () => {
    const a = newItem("category", "o"),
      b = newItem("category", "o", a.id),
      c = newItem("category", "o", b.id),
      d = newItem("category", "o");
    expect(categoryChoices([a, b, c, d], a.id).map((i) => i.id)).toEqual([
      d.id,
    ]);
  });
});
