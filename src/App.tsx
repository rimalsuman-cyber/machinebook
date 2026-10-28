import { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Factory,
  Plus,
  StickyNote,
  Settings,
  Search,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  Download,
  Printer,
  ShieldCheck,
  MapPin,
  Moon,
  Sun,
  X,
  AlertTriangle,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  supabase,
  memberships,
  download,
  fileBlob,
  AUTH_STORAGE_KEY,
} from "./api";
import { local } from "./db";
import { translate, type Key, type Language } from "./i18n";
import { csv, matches, newItem, type Item, type Membership } from "./model";
import { useWorkspace } from "./useWorkspace";
import { Editor, Empty, Files, Photo, contentKinds } from "./components";
import type { Session } from "@supabase/supabase-js";

export default function App() {
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem("mb-language") as Language) || "de",
  );
  const [dark, setDark] = useState(localStorage.getItem("mb-theme") === "dark");
  const [session, setSession] = useState<Session | null>(null),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(!!supabase),
    [members, setMembers] = useState<Membership[]>([]),
    [selected, setSelected] = useState(""),
    [authError, setAuthError] = useState("");
  const t = (key: Key) =>
    translate(["de", "en", "it"].includes(lang) ? lang : "de", key);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("mb-language", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mb-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        setSession(data.session);
        if (error) setAuthError(error.message);
      })
      .catch((e) => setAuthError(String(e)))
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setMembers([]);
      return;
    }
    let live = true;
    const cacheKey = `mb-members:${session.user.id}`;
    const load = async () => {
      try {
        const rows = navigator.onLine
          ? await memberships()
          : (JSON.parse(
              localStorage.getItem(cacheKey) || "[]",
            ) as Membership[]);
        if (!live) return;
        setMembers(rows);
        setSelected((old) =>
          rows.some((m) => m.org_id === old) ? old : rows[0]?.org_id || "",
        );
        if (navigator.onLine)
          localStorage.setItem(cacheKey, JSON.stringify(rows));
        setAuthError("");
      } catch (e) {
        if (live) setAuthError(String((e as Error).message || e));
      }
    };
    void load();
    window.addEventListener("online", load);
    return () => {
      live = false;
      window.removeEventListener("online", load);
    };
  }, [session?.user.id]);
  async function logout() {
    let resetClient = false;
    if (session) {
      const result = await supabase!.auth
        .signOut({ scope: "local" })
        .catch(() => ({ error: true }));
      resetClient = !!result.error;
      // A failed/offline server logout must still remove local authentication.
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
      await local.clearUser(session.user.id);
      localStorage.removeItem(`mb-members:${session.user.id}`);
    }
    setDemo(false);
    setSession(null);
    location.hash = "";
    if (resetClient) location.reload();
  }
  const membership = demo
    ? {
        org_id: "demo",
        user_id: "demo",
        role: "admin" as const,
        name: "Demo Workshop",
      }
    : members.find((m) => m.org_id === selected);
  if (loading)
    return (
      <div className="loading">
        <BookOpen />
        {t("loading")}
      </div>
    );
  if (membership)
    return (
      <Workspace
        key={`${membership.user_id}:${membership.org_id}`}
        member={membership}
        members={members}
        select={setSelected}
        demo={demo}
        lang={lang}
        setLang={setLang}
        dark={dark}
        setDark={setDark}
        logout={logout}
      />
    );
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand">
          <BookOpen />
          <strong>
            MachineBook <span>PRO</span>
          </strong>
        </div>
        <div>
          <p className="eyebrow">THE DIGITAL WORKSHOP</p>
          <h1>{t("subtitle")}</h1>
          <p>{t("dashboardText")}</p>
          <div className="blueprint">
            <Factory size={150} strokeWidth={0.7} />
            <span>01 / MACHINE KNOWLEDGE</span>
          </div>
        </div>
        <small>MachineBook Pro · {new Date().getFullYear()}</small>
      </div>
      <main className="login-form">
        <div className="flex justify-end gap-2">
          <LanguageSelect lang={lang} setLang={setLang} label={t("language")} />
          <button
            aria-label={t("theme")}
            className="icon"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
        </div>
        <BookOpen className="login-logo" />
        <h2>{session ? t("workspace") : t("signIn")}</h2>
        <p className="muted">
          {session
            ? t("workspaceMissing")
            : supabase
              ? t("loginText")
              : t("setup")}
        </p>
        {authError && (
          <p role="alert" className="error">
            {authError}
          </p>
        )}
        {supabase && !session && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setLoading(true);
              const { error } = await supabase!.auth.signInWithPassword({
                email: String(data.get("email")),
                password: String(data.get("password")),
              });
              setLoading(false);
              if (error) setAuthError(error.message);
            }}
          >
            <label>
              {t("email")}
              <input
                name="email"
                autoComplete="username"
                type="email"
                required
              />
            </label>
            <label>
              {t("password")}
              <input
                name="password"
                autoComplete="current-password"
                type="password"
                required
              />
            </label>
            <button className="primary w-full">
              {t("signIn")}
              <ChevronRight size={18} />
            </button>
          </form>
        )}
        {session && (
          <button onClick={() => void logout()}>{t("signOut")}</button>
        )}
        <button className="w-full demo-button" onClick={() => setDemo(true)}>
          {t("demo")}
          <ChevronRight size={18} />
        </button>
      </main>
    </div>
  );
}
function LanguageSelect({
  lang,
  setLang,
  label,
}: {
  lang: Language;
  setLang: (l: Language) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={lang}
      onChange={(e) => setLang(e.target.value as Language)}
    >
      <option value="de">Deutsch</option>
      <option value="en">English</option>
      <option value="it">Italiano</option>
    </select>
  );
}
type Screen = "home" | "machines" | "notes" | "settings";
function Workspace({
  member,
  members,
  select,
  demo,
  lang,
  setLang,
  dark,
  setDark,
  logout,
}: {
  member: Membership;
  members: Membership[];
  select: (id: string) => void;
  demo: boolean;
  lang: Language;
  setLang: (l: Language) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  logout: () => Promise<void>;
}) {
  const scope = `${member.user_id}:${member.org_id}`;
  const store = useWorkspace(scope, member.org_id, demo);
  const { items, pending, busy, ready } = store;
  const [screen, setScreen] = useState<Screen>("home"),
    [machineId, setMachineId] = useState(
      location.hash.startsWith("#machine/") ? location.hash.slice(9) : "",
    ),
    [tab, setTab] = useState<Key>("overview"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("updated"),
    [editing, setEditing] = useState<Item | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [drafts, setDrafts] = useState<Item[]>([]),
    [working, setWorking] = useState(false);
  const t = (key: Key) => translate(lang, key);
  const canEdit = member.role === "admin";
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const hash = () =>
      setMachineId(
        location.hash.startsWith("#machine/") ? location.hash.slice(9) : "",
      );
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    void local
      .drafts(scope)
      .then(setDrafts)
      .catch((e) => setError(String(e)));
  }, [scope, editing]);
  function fail(e: unknown) {
    setError(
      e instanceof Error
        ? e.message
        : String((e as { message?: string })?.message || e),
    );
  }
  function go(next: Screen) {
    setScreen(next);
    setMachineId("");
    location.hash = "";
    setSearch("");
  }
  function openMachine(id: string) {
    setMachineId(id);
    location.hash = `machine/${id}`;
    setTab("overview");
  }
  function create(kind: Item["kind"], parent: string | null = null) {
    const item = newItem(kind, member.org_id, parent);
    if (["note", "issue", "step"].includes(kind))
      item.data.date = new Date().toISOString().slice(0, 10);
    if (kind === "step")
      item.data.order = String(
        items.filter((i) => i.kind === "step" && i.parent_id === parent).length,
      );
    setEditing(item);
  }
  async function save(item: Item) {
    if (!canEdit) throw new Error(t("viewer"));
    await store.save(item);
    setNotice(t("saved"));
  }
  async function remove(item: Item) {
    if (
      item.kind === "category" &&
      items.some(
        (i) =>
          i.category_id === item.id ||
          (i.kind === "category" && i.parent_id === item.id),
      )
    )
      throw new Error(t("categoryInUse"));
    if (!confirm(t("confirmDelete"))) return;
    await store.save(item, true);
    if (item.id === machineId) go("machines");
  }
  const machines = items.filter((i) => i.kind === "machine");
  const categories = items.filter((i) => i.kind === "category");
  const filtered = machines
    .filter(
      (i) =>
        (!category || i.category_id === category) && matches(i, search, items),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.data.name.localeCompare(b.data.name)
        : b.updated_at.localeCompare(a.updated_at),
    );
  const machine = items.find((i) => i.id === machineId && i.kind === "machine");
  const notes = items
    .filter((i) => i.kind === "note" && matches(i, search, items))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  function cover(item: Item) {
    return (
      items.find((i) => i.id === item.data.cover) ||
      items.find(
        (i) =>
          i.kind === "asset" &&
          i.parent_id === item.id &&
          i.data.mime.startsWith("image/"),
      )
    );
  }
  const nav = [
    { id: "home", icon: LayoutDashboard },
    { id: "machines", icon: Factory },
    { id: "notes", icon: StickyNote },
    { id: "settings", icon: Settings },
  ] as const;
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  function machineCard(m: Item) {
    return (
      <button
        className="machine-card"
        key={m.id}
        onClick={() => openMachine(m.id)}
      >
        <div className="machine-image">
          <Photo item={cover(m)} scope={scope} />
          <span className="machine-tag">
            {categories.find((c) => c.id === m.category_id)?.data.name}
          </span>
        </div>
        <div className="machine-card-body">
          <small>
            {m.data.identifier || "—"} <span>· {m.data.model || "—"}</span>
          </small>
          <h3>{m.data.name}</h3>
          <p>
            <MapPin size={14} />
            {m.data.location || "—"}
            <ChevronRight size={18} />
          </p>
        </div>
      </button>
    );
  }
  const toolbar = (
    <div className="toolbar no-print">
      <label className="search">
        <Search size={19} />
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <select
        aria-label={t("category")}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">{t("all")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.data.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t("sort")}
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="updated">{t("updated")}</option>
        <option value="name">{t("name")}</option>
      </select>
    </div>
  );
  if (!ready)
    return (
      <div className="loading">
        {t("loading")}
        {store.error && <p role="alert">{store.error}</p>}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <a className="brand" href="#" onClick={() => go("home")}>
          <BookOpen />
          <strong>
            MachineBook <span>PRO</span>
          </strong>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">{member.name.slice(0, 1)}</span>
          <div>
            <strong>{member.name}</strong>
            <small>{t(member.role)}</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={screen === id && !machine ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              {t(id)}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={22} />
          <strong>MachineBook Pro</strong>
          <p>{t("subtitle")}</p>
          <small>v1.0 · {demo ? t("localOnly") : t("account")}</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar no-print">
          <div className="mobile-brand">
            <BookOpen />
            <strong>
              MachineBook <span>PRO</span>
            </strong>
          </div>
          <div className="breadcrumb">
            {member.name}
            <ChevronRight size={14} />
            {machine ? machine.data.name : t(screen)}
          </div>
          <div className="top-actions">
            <span className={`connection ${online ? "" : "is-offline"}`}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{t(online ? "online" : "offline")}</span>
            </span>
            <button
              className="icon"
              aria-label={t("theme")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="avatar">{member.role === "admin" ? "A" : "V"}</div>
          </div>
        </header>
        {demo && <div className="demo-banner no-print">{t("demoBanner")}</div>}
        <main>
          {(error || store.error) && (
            <div role="alert" className="error no-print">
              <AlertTriangle size={18} />
              <span>{error || store.error}</span>
              <button
                className="icon"
                aria-label={t("close")}
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice no-print">
              {notice}
              <button
                className="icon"
                aria-label={t("close")}
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {pending.length > 0 && (
            <div className="sync-banner no-print">
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              {pending.length} {t("pending")}
              <button
                disabled={busy || !online}
                onClick={() => void store.sync()}
              >
                {t("sync")}
              </button>
            </div>
          )}
          {pending
            .filter((p) => p.conflict)
            .map((p) => (
              <div className="conflict no-print" key={p.item.id}>
                <strong>
                  {t("conflict")}: {p.item.data.name || p.item.data.title}
                </strong>
                <pre>{JSON.stringify(p.item.data, null, 2)}</pre>
                <p>{p.conflict}</p>
                <button
                  onClick={() =>
                    void store.resolve(p.item.id, false).catch(fail)
                  }
                >
                  {t("useRemote")}
                </button>
                <button
                  onClick={() =>
                    void store.resolve(p.item.id, true).catch(fail)
                  }
                >
                  {t("keepLocal")}
                </button>
              </div>
            ))}
          {machine ? (
            <>
              <button className="back no-print" onClick={() => go("machines")}>
                <ArrowLeft size={17} />
                {t("machines")}
              </button>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {
                      categories.find((c) => c.id === machine.category_id)?.data
                        .name
                    }{" "}
                    / {machine.data.identifier}
                  </p>
                  <h1>{machine.data.name}</h1>
                  <p>
                    {machine.data.manufacturer} · {machine.data.model}
                  </p>
                </div>
                <div className="actions no-print">
                  <button onClick={() => window.print()}>
                    <Printer size={17} />
                    {t("print")}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => setEditing(machine)}
                      >
                        <Pencil size={17} />
                        {t("edit")}
                      </button>
                      <button
                        disabled={busy}
                        className="icon danger"
                        aria-label={t("delete")}
                        onClick={() => void remove(machine).catch(fail)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="tabs no-print">
                {(
                  [
                    "overview",
                    "gallery",
                    "steps",
                    "notes",
                    "issues",
                    "documents",
                  ] as Key[]
                ).map((k) => (
                  <button
                    className={tab === k ? "active" : ""}
                    key={k}
                    onClick={() => setTab(k)}
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
              <div className="safety">
                <ShieldCheck size={19} />
                {t("safety")}
              </div>
              {tab === "overview" && (
                <div className="detail-grid">
                  <div className="detail-photo">
                    <Photo item={cover(machine)} scope={scope} />
                  </div>
                  <section className="panel">
                    <h2>{t("overview")}</h2>
                    <dl>
                      {(
                        [
                          "type",
                          "manufacturer",
                          "model",
                          "serial",
                          "identifier",
                          "department",
                          "location",
                          "year",
                        ] as Key[]
                      ).map((k) => (
                        <div key={k}>
                          <dt>{t(k)}</dt>
                          <dd>{machine.data[k] || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  {(["specifications", "description", "notes"] as Key[]).map(
                    (k) => (
                      <section className="panel" key={k}>
                        <h2>{t(k)}</h2>
                        <p className="whitespace-pre-wrap">
                          {machine.data[k] || "—"}
                        </p>
                      </section>
                    ),
                  )}
                </div>
              )}
              {(tab === "gallery" || tab === "documents") && (
                <section className="panel">
                  <h2>{t(tab)}</h2>
                  <Files
                    parent={machine}
                    mode={tab === "documents" ? "documents" : "photos"}
                    items={items.filter(
                      (i) =>
                        i.kind !== "asset" ||
                        (tab === "gallery"
                          ? i.data.mime.startsWith("image/")
                          : !i.data.mime.startsWith("image/")),
                    )}
                    scope={scope}
                    t={t}
                    canEdit={canEdit && !busy}
                    save={save}
                    remove={remove}
                    edit={setEditing}
                    onError={fail}
                    cover={async (file) =>
                      save({
                        ...machine,
                        data: { ...machine.data, cover: file.id },
                      })
                    }
                  />
                </section>
              )}
              {contentKinds
                .filter((c) => c.tab === tab)
                .map(({ kind }) => {
                  const children = items
                    .filter(
                      (i) => i.kind === kind && i.parent_id === machine.id,
                    )
                    .sort((a, b) =>
                      kind === "step"
                        ? Number(a.data.order || 0) - Number(b.data.order || 0)
                        : b.updated_at.localeCompare(a.updated_at),
                    );
                  return (
                    <section key={kind}>
                      <div className="section-heading">
                        <h2>
                          {t(tab)} <span>{children.length}</span>
                        </h2>
                        {canEdit && (
                          <button
                            className="primary no-print"
                            disabled={busy}
                            onClick={() => create(kind, machine.id)}
                          >
                            <Plus size={18} />
                            {t("add")}
                          </button>
                        )}
                      </div>
                      {kind === "issue" && (
                        <p className="muted">{t("beforeAfter")}</p>
                      )}
                      {children.length === 0 && <Empty t={t} />}
                      <div className="entries">
                        {children.map((entry, index) => (
                          <article className="panel entry" key={entry.id}>
                            <header>
                              {kind === "step" && (
                                <div className="step-number">
                                  {String(index + 1).padStart(2, "0")}
                                </div>
                              )}
                              <div>
                                <small>
                                  {entry.data.date || fmt(entry.updated_at)}
                                </small>
                                <h3>{entry.data.title}</h3>
                              </div>
                              {canEdit && (
                                <div className="actions no-print">
                                  {kind === "step" &&
                                    [-1, 1].map((direction) => (
                                      <button
                                        key={direction}
                                        className="icon"
                                        disabled={
                                          busy ||
                                          index + direction < 0 ||
                                          index + direction >= children.length
                                        }
                                        aria-label={t(
                                          direction === -1 ? "up" : "down",
                                        )}
                                        onClick={() =>
                                          void (async () => {
                                            const ordered = [...children];
                                            [
                                              ordered[index],
                                              ordered[index + direction],
                                            ] = [
                                              ordered[index + direction],
                                              ordered[index],
                                            ];
                                            for (
                                              let n = 0;
                                              n < ordered.length;
                                              n++
                                            )
                                              await save({
                                                ...ordered[n],
                                                data: {
                                                  ...ordered[n].data,
                                                  order: String(n),
                                                },
                                              });
                                          })().catch(fail)
                                        }
                                      >
                                        {direction === -1 ? (
                                          <ArrowUp size={16} />
                                        ) : (
                                          <ArrowDown size={16} />
                                        )}
                                      </button>
                                    ))}
                                  <button
                                    className="icon"
                                    disabled={busy}
                                    aria-label={t("edit")}
                                    onClick={() => setEditing(entry)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    className="icon danger"
                                    disabled={busy}
                                    aria-label={t("delete")}
                                    onClick={() =>
                                      void remove(entry).catch(fail)
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </header>
                            <p className="whitespace-pre-wrap">
                              {entry.data.body}
                            </p>
                            {kind === "issue" && (
                              <div className="issue-grid">
                                <div>
                                  <h4>{t("cause")}</h4>
                                  <p className="whitespace-pre-wrap">
                                    {entry.data.cause}
                                  </p>
                                </div>
                                <div>
                                  <h4>{t("solution")}</h4>
                                  <p className="whitespace-pre-wrap">
                                    {entry.data.solution}
                                  </p>
                                </div>
                              </div>
                            )}
                            <Files
                              parent={entry}
                              items={items}
                              scope={scope}
                              t={t}
                              canEdit={canEdit && !busy}
                              save={save}
                              remove={remove}
                              edit={setEditing}
                              onError={fail}
                            />
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    MACHINEBOOK / {t(screen).toUpperCase()}
                  </p>
                  <h1>{screen === "home" ? t("greeting") : t(screen)}</h1>
                  <p>
                    {screen === "home" ? t("dashboardText") : t("subtitle")}
                  </p>
                </div>
                {canEdit && screen !== "settings" && (
                  <button
                    className="primary no-print"
                    disabled={busy}
                    onClick={() => create("machine")}
                  >
                    <Plus size={19} />
                    {t("addMachine")}
                  </button>
                )}
              </div>
              {screen === "home" && (
                <>
                  <div className="stats">
                    <div>
                      <span className="stat-icon">
                        <Factory />
                      </span>
                      <p>
                        {t("machines")}
                        <strong>
                          {String(machines.length).padStart(2, "0")}
                        </strong>
                      </p>
                      <small>01</small>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <Layers />
                      </span>
                      <p>
                        {t("categories")}
                        <strong>
                          {String(categories.length).padStart(2, "0")}
                        </strong>
                      </p>
                      <small>02</small>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <BookOpen />
                      </span>
                      <p>
                        {t("content")}
                        <strong>
                          {String(
                            items.filter((i) =>
                              ["note", "step", "issue"].includes(i.kind),
                            ).length,
                          ).padStart(2, "0")}
                        </strong>
                      </p>
                      <small>03</small>
                    </div>
                  </div>
                  {toolbar}
                  <section>
                    <div className="section-heading">
                      <h2>{t("categories")}</h2>
                      {canEdit && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => create("category")}
                        >
                          <Plus size={16} />
                          {t("addCategory")}
                        </button>
                      )}
                    </div>
                    <div className="category-grid">
                      {categories.map((c) => (
                        <article className="category-card" key={c.id}>
                          <button
                            className="category-open"
                            onClick={() => {
                              go("machines");
                              setCategory(c.id);
                            }}
                          >
                            {cover(c) ? (
                              <Photo item={cover(c)} scope={scope} />
                            ) : (
                              <Layers size={25} />
                            )}
                            <div>
                              <h3>{c.data.name}</h3>
                              <small>
                                {c.parent_id
                                  ? `${categories.find((x) => x.id === c.parent_id)?.data.name} · `
                                  : ""}
                                {
                                  machines.filter((m) => m.category_id === c.id)
                                    .length
                                }{" "}
                                {t("machines")}
                              </small>
                            </div>
                            <ChevronRight size={16} />
                          </button>
                          {canEdit && (
                            <div className="category-actions">
                              <button
                                className="icon"
                                disabled={busy}
                                aria-label={`${t("edit")} ${c.data.name}`}
                                onClick={() => setEditing(c)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="icon danger"
                                disabled={busy}
                                aria-label={`${t("delete")} ${c.data.name}`}
                                onClick={() => void remove(c).catch(fail)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                    {categories.length === 0 && <Empty t={t} />}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>{t("recent")}</h2>
                      <button
                        className="text-button"
                        onClick={() => go("machines")}
                      >
                        {t("seeAll")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="machine-grid">
                      {(search || category
                        ? filtered
                        : [...machines].sort((a, b) =>
                            b.created_at.localeCompare(a.created_at),
                          )
                      )
                        .slice(0, 6)
                        .map(machineCard)}
                    </div>
                    {machines.length === 0 && <Empty t={t} />}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>{t("recentNotes")}</h2>
                      <button
                        className="text-button"
                        onClick={() => go("notes")}
                      >
                        {t("seeAll")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="note-list">
                      {notes.slice(0, 4).map((note) => (
                        <button
                          key={note.id}
                          onClick={() => {
                            openMachine(note.parent_id!);
                            setTab("notes");
                          }}
                        >
                          <span className="note-icon">
                            <StickyNote size={21} />
                          </span>
                          <div>
                            <h3>{note.data.title}</h3>
                            <p>
                              {
                                machines.find((m) => m.id === note.parent_id)
                                  ?.data.name
                              }
                            </p>
                          </div>
                          <small>{fmt(note.updated_at)}</small>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {screen === "machines" && (
                <>
                  {toolbar}
                  <div className="section-heading">
                    <h2>
                      {filtered.length} {t("machines")}
                    </h2>
                    {canEdit && (
                      <button onClick={() => create("category")}>
                        <Plus size={16} />
                        {t("addCategory")}
                      </button>
                    )}
                  </div>
                  <div className="machine-grid">
                    {filtered.map(machineCard)}
                  </div>
                  {filtered.length === 0 && <Empty t={t} />}
                </>
              )}
              {screen === "notes" && (
                <>
                  <label className="search mb-6">
                    <Search size={19} />
                    <input
                      aria-label={t("search")}
                      placeholder={t("search")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  {canEdit && (
                    <label className="mb-6">
                      {t("addNote")}
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) create("note", e.target.value);
                        }}
                      >
                        <option value="">{t("pickMachine")}</option>
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.data.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="note-list">
                    {notes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => {
                          openMachine(note.parent_id!);
                          setTab("notes");
                        }}
                      >
                        <StickyNote size={22} />
                        <div>
                          <h3>{note.data.title}</h3>
                          <p>{note.data.body.slice(0, 160)}</p>
                          <small>
                            {
                              machines.find((m) => m.id === note.parent_id)
                                ?.data.name
                            }
                          </small>
                        </div>
                        <small>{fmt(note.updated_at)}</small>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  </div>
                  {notes.length === 0 && <Empty t={t} />}
                </>
              )}
              {screen === "settings" && (
                <div className="settings-grid">
                  <section className="panel">
                    <h2>{t("account")}</h2>
                    <p>
                      {member.name} · {t(member.role)}
                    </p>
                    {members.length > 1 && (
                      <label>
                        {t("workspace")}
                        <select
                          value={member.org_id}
                          onChange={(e) => select(e.target.value)}
                        >
                          {members.map((m) => (
                            <option key={m.org_id} value={m.org_id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      {t("language")}
                      <LanguageSelect
                        lang={lang}
                        setLang={setLang}
                        label={t("language")}
                      />
                    </label>
                    <label>
                      {t("theme")}
                      <select
                        value={dark ? "dark" : "light"}
                        onChange={(e) => setDark(e.target.value === "dark")}
                      >
                        <option value="light">{t("light")}</option>
                        <option value="dark">{t("dark")}</option>
                      </select>
                    </label>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() =>
                        void (async () => {
                          if (
                            (pending.length || drafts.length) &&
                            !confirm(t("unsyncedLogout"))
                          )
                            return;
                          await logout();
                        })().catch(fail)
                      }
                    >
                      <LogOut size={17} />
                      {t("signOut")}
                    </button>
                  </section>
                  <section className="panel">
                    <h2>{t("sync")}</h2>
                    <p>
                      {demo
                        ? t("localOnly")
                        : busy
                          ? t("syncing")
                          : pending.length
                            ? `${pending.length} ${t("pending")}`
                            : t("synced")}
                    </p>
                    <p className="muted">{t("offlineHelp")}</p>
                    <button
                      disabled={busy || !online}
                      onClick={() => void store.sync()}
                    >
                      <RefreshCw size={17} />
                      {t("sync")}
                    </button>
                    <button
                      disabled={working || !online}
                      onClick={() =>
                        void (async () => {
                          setWorking(true);
                          try {
                            for (const item of items.filter(
                              (i) => i.kind === "asset",
                            ))
                              await fileBlob(scope, item);
                            setNotice(t("cacheDone"));
                          } finally {
                            setWorking(false);
                          }
                        })().catch(fail)
                      }
                    >
                      <Download size={17} />
                      {working ? t("loading") : t("cacheFiles")}
                    </button>
                  </section>
                  <section className="panel">
                    <h2>{t("export")}</h2>
                    <p className="muted">{t("exportHelp")}</p>
                    <div className="actions">
                      <button
                        onClick={() =>
                          download(
                            "machinebook.json",
                            new Blob(
                              [
                                JSON.stringify(
                                  {
                                    version: 1,
                                    exportedAt: new Date().toISOString(),
                                    items,
                                  },
                                  null,
                                  2,
                                ),
                              ],
                              { type: "application/json" },
                            ),
                          )
                        }
                      >
                        JSON <Download size={16} />
                      </button>
                      <button
                        onClick={() =>
                          download(
                            "machinebook.csv",
                            new Blob([csv(items)], {
                              type: "text/csv;charset=utf-8",
                            }),
                          )
                        }
                      >
                        CSV <Download size={16} />
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        void local
                          .drafts(scope)
                          .then((data) =>
                            download(
                              "machinebook-drafts.json",
                              new Blob(
                                [
                                  JSON.stringify(
                                    { drafts: data, pending },
                                    null,
                                    2,
                                  ),
                                ],
                                { type: "application/json" },
                              ),
                            ),
                          )
                          .catch(fail)
                      }
                    >
                      {t("exportDrafts")}
                    </button>
                  </section>
                  <section className="panel">
                    <h2>{t("install")}</h2>
                    <p>{t("installHelp")}</p>
                    {needRefresh && (
                      <button onClick={() => void updateServiceWorker(true)}>
                        {t("update")}
                      </button>
                    )}
                  </section>
                  <section className="panel full">
                    <h2>
                      {t("drafts")} ({drafts.length})
                    </h2>
                    {drafts.map((d) => (
                      <div className="draft-row" key={d.id}>
                        <span>
                          {d.data.name || d.data.title || t("edit")} · {d.kind}
                        </span>
                        <button
                          disabled={!canEdit || busy}
                          onClick={() => setEditing(d)}
                        >
                          {t("resume")}
                        </button>
                        <button
                          className="danger"
                          onClick={() =>
                            void (async () => {
                              if (confirm(t("confirmDelete"))) {
                                await local.removeDraft(scope, d.id);
                                setDrafts(await local.drafts(scope));
                              }
                            })().catch(fail)
                          }
                        >
                          {t("discard")}
                        </button>
                      </div>
                    ))}
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="page-footer no-print">
            <span>MachineBook Pro</span>
            <span>
              <ShieldCheck size={13} />
              {demo ? t("localOnly") : t("account")}
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav no-print">
        {nav.slice(0, 2).map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <Icon size={21} />
            <span>{t(id)}</span>
          </button>
        ))}
        <button
          className="add-nav"
          disabled={!canEdit || busy}
          onClick={() => create("machine")}
        >
          <Plus size={24} />
          <span>{t("add")}</span>
        </button>
        {nav.slice(2).map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <Icon size={21} />
            <span>{t(id)}</span>
          </button>
        ))}
      </nav>
      {editing && (
        <Editor
          key={editing.id}
          initial={editing}
          items={items}
          scope={scope}
          t={t}
          onSave={save}
          onClose={() => setEditing(null)}
          onError={fail}
        >
          {editing.kind === "category" && editing.revision > 0 && (
            <Files
              parent={editing}
              items={items}
              scope={scope}
              t={t}
              canEdit={canEdit && !busy}
              save={save}
              remove={remove}
              edit={setEditing}
              onError={fail}
            />
          )}
        </Editor>
      )}
    </div>
  );
}
