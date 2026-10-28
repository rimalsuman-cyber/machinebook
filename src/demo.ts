import { newItem, type Workspace } from "./model";
export function demoData(): Workspace {
  const categories = ["CNC Milling", "CNC Turning", "Measuring Equipment"].map(
    (name) => ({ ...newItem("category", "demo"), data: { name } }),
  );
  const machines = [
    "Demo • Precision Mill",
    "Demo • Turning Center",
    "Demo • Optical Inspection",
  ].map((name, n) => ({
    ...newItem("machine", "demo"),
    category_id: categories[n].id,
    data: {
      name,
      model: `DEMO-${100 + n}`,
      manufacturer: "Fictional Industries",
      identifier: `MB-00${n + 1}`,
      location: `Workshop ${n + 1}`,
      description:
        "Fictional demonstration equipment. No real operating instructions.",
      type: "Demo",
      specifications: "Sample data only",
    },
    revision: 1,
  }));
  const note = {
    ...newItem("note", "demo", machines[0].id),
    data: {
      title: "Welcome to MachineBook",
      body: "This is a local demonstration. Add a machine, upload photos and create your own illustrated notes. No demo data is uploaded to Supabase.",
      date: new Date().toISOString().slice(0, 10),
    },
    revision: 1,
  };
  return { items: [...categories, ...machines, note], pending: [] };
}
