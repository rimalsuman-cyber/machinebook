import { useEffect, useState, useRef, useId, type ReactNode } from "react";
import {
  Camera,
  Download,
  FileText,
  ImagePlus,
  X,
  Factory,
  Trash2,
  Pencil,
  Image as ImageIcon,
} from "lucide-react";
import { local } from "./db";
import { compressImage, download, fileBlob } from "./api";
import { categoryChoices, newItem, type Item, type Kind } from "./model";
import type { Key } from "./i18n";
export type T = (key: Key) => string;
export function Empty({ t, children }: { t: T; children?: ReactNode }) {
  return (
    <div className="empty">
      <Factory size={36} />
      <h3>{t("empty")}</h3>
      <p>{t("emptyText")}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
  closeLabel = "Close",
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button className="icon" aria-label={closeLabel} onClick={close}>
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Photo({
  item,
  scope,
  className = "",
  onError,
}: {
  item?: Item;
  scope: string;
  className?: string;
  onError?: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    let object = "";
    if (item)
      void fileBlob(scope, item)
        .then((blob) => {
          object = URL.createObjectURL(blob);
          if (live) setUrl(object);
          else URL.revokeObjectURL(object);
        })
        .catch((e) => onError?.(String(e)));
    return () => {
      live = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [item?.id, scope]);
  return url ? (
    <img
      className={className}
      src={url}
      alt={item?.data.caption || item?.data.name || ""}
    />
  ) : (
    <div className={`photo-placeholder ${className}`}>
      <Factory size={48} />
      <span>MachineBook</span>
    </div>
  );
}
const machineFields: Key[] = [
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
export function Editor({
  initial,
  items,
  scope,
  t,
  onSave,
  onClose,
  onError,
  children,
}: {
  initial: Item;
  items: Item[];
  scope: string;
  t: T;
  onSave: (item: Item) => Promise<void>;
  onClose: () => void;
  onError: (error: unknown) => void;
  children?: ReactNode;
}) {
  const [item, setItem] = useState(initial),
    [saving, setSaving] = useState(false),
    [draftStatus, setDraftStatus] = useState(""),
    [formError, setFormError] = useState("");
  const latest = useRef(initial);
  const writes = useRef(Promise.resolve());
  function change(next: Item) {
    setItem(next);
    latest.current = next;
    writes.current = writes.current
      .catch(() => {})
      .then(() => local.saveDraft(scope, next));
    void writes.current
      .then(() => setDraftStatus(t("savedDraft")))
      .catch(onError);
  }
  const field = (key: Key, multiline = false) => (
    <label key={key}>
      {t(key)}
      {["name", "title"].includes(key) && " *"}
      {multiline ? (
        <textarea
          rows={4}
          value={item.data[key] || ""}
          onChange={(e) =>
            change({ ...item, data: { ...item.data, [key]: e.target.value } })
          }
        />
      ) : (
        <input
          required={["name", "title"].includes(key)}
          maxLength={key === "name" || key === "title" ? 200 : 1000}
          type={key === "date" ? "date" : key === "year" ? "number" : "text"}
          min={key === "year" ? 1800 : undefined}
          max={key === "year" ? 2200 : undefined}
          value={item.data[key] || ""}
          onChange={(e) =>
            change({ ...item, data: { ...item.data, [key]: e.target.value } })
          }
        />
      )}
    </label>
  );
  return (
    <Modal title={t("edit")} close={onClose} closeLabel={t("close")}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setFormError("");
          try {
            await writes.current;
            await onSave(latest.current);
            await local.removeDraft(scope, item.id);
            onClose();
          } catch (err) {
            setFormError(String((err as Error).message || err));
            onError(err);
          } finally {
            setSaving(false);
          }
        }}
      >
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <p className="muted text-sm">
          {t("draftHelp")} <span role="status">{draftStatus}</span>
        </p>
        <div className="form-grid">
          {item.kind === "machine" ? (
            <>
              {machineFields.map((k) =>
                field(
                  k,
                  ["specifications", "description", "notes"].includes(k),
                ),
              )}
              <label>
                {t("category")} *
                <select
                  required
                  value={item.category_id || ""}
                  onChange={(e) =>
                    change({ ...item, category_id: e.target.value })
                  }
                >
                  <option value="">{t("choose")}</option>
                  {items
                    .filter((i) => i.kind === "category")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.data.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : item.kind === "category" ? (
            <>
              {field("name")}
              <label>
                {t("parent")}
                <select
                  value={item.parent_id || ""}
                  onChange={(e) =>
                    change({ ...item, parent_id: e.target.value || null })
                  }
                >
                  <option value="">{t("none")}</option>
                  {categoryChoices(items, item.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
                </select>
              </label>
              {field("description", true)}
            </>
          ) : item.kind === "asset" ? (
            field("caption", true)
          ) : (
            <>
              {field("title")}
              {field("date")}
              {field("body", true)}
              {item.kind === "issue" && (
                <>
                  {field("cause", true)}
                  {field("solution", true)}
                </>
              )}
            </>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary" disabled={saving}>
            {saving ? t("loading") : t("save")}
          </button>
        </footer>
      </form>
      {children}
    </Modal>
  );
}
export function Files({
  parent,
  items,
  scope,
  t,
  canEdit,
  save,
  remove,
  edit,
  onError,
  cover,
  mode = "photos",
}: {
  parent: Item;
  items: Item[];
  scope: string;
  t: T;
  canEdit: boolean;
  save: (item: Item) => Promise<void>;
  remove: (item: Item) => Promise<void>;
  edit: (item: Item) => void;
  onError: (error: unknown) => void;
  cover?: (item: Item) => Promise<void>;
  mode?: "photos" | "documents";
}) {
  const [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState<Item | null>(null);
  const files = items.filter(
    (i) => i.kind === "asset" && i.parent_id === parent.id,
  );
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > 20 * 1024 * 1024) throw new Error(t("fileLimit"));
        const photo = ["image/jpeg", "image/png", "image/webp"].includes(
          file.type,
        );
        if (
          (mode === "photos" && !photo) ||
          (mode === "documents" && !/\.(pdf|txt|csv|dxf)$/i.test(file.name))
        )
          throw new Error(t("fileLimit"));
        const blob = photo ? await compressImage(file) : file;
        const asset = newItem("asset", parent.org_id, parent.id);
        const extension = file.name.split(".").pop()?.toLowerCase();
        const mime = photo
          ? "image/jpeg"
          : extension === "pdf"
            ? "application/pdf"
            : extension === "csv"
              ? "text/csv"
              : extension === "txt"
                ? "text/plain"
                : "application/dxf";
        asset.data = {
          name: photo ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name,
          caption: file.name,
          path: `${parent.org_id}/${asset.id}`,
          mime,
          size: String(blob.size),
        };
        await local.putBlob(scope, asset.id, blob);
        await save(asset);
      }
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="files">
      {canEdit && (
        <div className="upload-actions no-print">
          <label className="button">
            <ImagePlus size={17} />
            {busy ? t("loading") : t("upload")}
            <input
              aria-label={t("upload")}
              type="file"
              multiple
              accept={
                mode === "photos"
                  ? "image/jpeg,image/png,image/webp"
                  : ".pdf,.txt,.csv,.dxf"
              }
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {mode === "photos" && (
            <label className="button">
              <Camera size={17} />
              {t("camera")}
              <input
                aria-label={t("camera")}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={busy}
                onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <small>{t("fileLimit")}</small>
        </div>
      )}
      <div className="file-grid">
        {files.map((file) => (
          <article className="file-card" key={file.id}>
            {file.data.mime.startsWith("image/") ? (
              <button
                className="photo-button"
                onClick={() => setZoom(file)}
                aria-label={file.data.caption || file.data.name}
              >
                <Photo item={file} scope={scope} />
              </button>
            ) : (
              <div className="document-icon">
                <FileText size={40} />
              </div>
            )}
            <div className="p-3">
              <p className="font-medium break-words">
                {file.data.caption || file.data.name}
              </p>
              <small>{(Number(file.data.size) / 1024).toFixed(0)} KB</small>
              <div className="actions no-print">
                <button
                  className="icon"
                  title={t("download")}
                  aria-label={t("download")}
                  onClick={() =>
                    void fileBlob(scope, file)
                      .then((blob) => download(file.data.name, blob))
                      .catch(onError)
                  }
                >
                  <Download size={16} />
                </button>
                {canEdit && (
                  <>
                    <button
                      className="icon"
                      aria-label={t("edit")}
                      onClick={() => edit(file)}
                    >
                      <Pencil size={16} />
                    </button>
                    {cover && file.data.mime.startsWith("image/") && (
                      <button
                        className="icon"
                        title={t("mainPhoto")}
                        aria-label={t("mainPhoto")}
                        onClick={() => void cover(file).catch(onError)}
                      >
                        <ImageIcon size={16} />
                      </button>
                    )}
                    <button
                      className="icon danger"
                      aria-label={t("delete")}
                      onClick={() => void remove(file).catch(onError)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {zoom && (
        <Modal
          title={zoom.data.caption || zoom.data.name}
          close={() => setZoom(null)}
        >
          <Photo item={zoom} scope={scope} className="zoom" />
        </Modal>
      )}
    </div>
  );
}
export const contentKinds: { tab: Key; kind: Kind }[] = [
  { tab: "steps", kind: "step" },
  { tab: "notes", kind: "note" },
  { tab: "issues", kind: "issue" },
];
