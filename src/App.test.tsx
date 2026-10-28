// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  render,
  screen,
  within,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, afterEach, it, expect, vi } from "vitest";
import App from "./App";
import { local } from "./db";
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [false], updateServiceWorker: vi.fn() }),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.confirm = () => true;
});
afterEach(cleanup);
it("creates, edits, finds and deletes persisted demo content through the app", async () => {
  await local.clearUser("demo");
  localStorage.clear();
  location.hash = "";
  const user = userEvent.setup();
  const app = render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /Lokale Demo öffnen/ }),
  );
  await screen.findByRole("heading", { name: "Ihr Maschinenhandbuch" });
  await user.click(screen.getByRole("button", { name: "Kategorie erstellen" }));
  let dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name *"), "QA Category");
  await user.click(within(dialog).getByRole("button", { name: "Speichern" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Maschine erfassen" }));
  dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name *"), "QA Machine");
  await user.type(within(dialog).getByLabelText("Modellnummer"), "QA-42");
  await user.selectOptions(
    within(dialog).getByLabelText("Kategorie *"),
    within(dialog).getByRole("option", { name: "QA Category" }),
  );
  await user.click(within(dialog).getByRole("button", { name: "Speichern" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: /QA-42.*QA Machine/ }));
  await screen.findByRole("heading", { name: "QA Machine" });
  const notesButtons = screen.getAllByRole("button", { name: "Notizen" });
  await user.click(
    notesButtons.find((b) => b.parentElement?.classList.contains("tabs"))!,
  );
  await user.click(
    screen
      .getAllByRole("button", { name: "Hinzufügen" })
      .find((b) => b.classList.contains("primary"))!,
  );
  dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Titel *"), "QA note");
  await user.type(
    within(dialog).getByLabelText("Inhalt"),
    "Unique coolant reference",
  );
  await user.click(within(dialog).getByRole("button", { name: "Speichern" }));
  await screen.findByRole("heading", { name: "QA note" });
  const stored = await local.read("demo:demo");
  expect(
    stored!.items.some((i) => i.data.body === "Unique coolant reference"),
  ).toBe(true);
  app.unmount();
  location.hash = "";
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /Lokale Demo öffnen/ }),
  );
  await screen.findByRole("heading", { name: "Ihr Maschinenhandbuch" });
  await user.type(
    screen.getByPlaceholderText("Maschinen, Modelle, Notizen durchsuchen …"),
    "Unique coolant",
  );
  await user.click(screen.getByRole("button", { name: /QA-42.*QA Machine/ }));
  await user.click(screen.getByRole("button", { name: "Bearbeiten" }));
  dialog = screen.getByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Name *"));
  await user.type(
    within(dialog).getByLabelText("Name *"),
    "QA Machine Updated",
  );
  await user.click(within(dialog).getByRole("button", { name: "Speichern" }));
  await screen.findByRole("heading", { name: "QA Machine Updated" });
  await user.click(screen.getByRole("button", { name: "Löschen" }));
  await waitFor(async () =>
    expect(
      (await local.read("demo:demo"))!.items.some(
        (i) =>
          i.data.name === "QA Machine Updated" || i.data.title === "QA note",
      ),
    ).toBe(false),
  );
}, 30000);
