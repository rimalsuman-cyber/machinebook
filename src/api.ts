import { createClient } from "@supabase/supabase-js";
import { local } from "./db";
import type { Item, Membership } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const AUTH_STORAGE_KEY = `machinebook-auth-${url ? new URL(url).hostname : "demo"}`;
export const supabase =
  url && key && !url.includes("YOUR_PROJECT")
    ? createClient(url, key, { auth: { storageKey: AUTH_STORAGE_KEY } })
    : null;
export async function memberships(): Promise<Membership[]> {
  const { data, error } = await supabase!.rpc("my_workspaces");
  if (error) throw error;
  return data || [];
}
export async function fetchItems(org: string): Promise<Item[]> {
  const result: Item[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabase!
      .from("items")
      .select("*")
      .eq("org_id", org)
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    result.push(...(data as Item[]));
    if (data.length < 500) return result;
    start += 500;
  }
}
export async function saveRemote(
  item: Item,
  expected: number,
  scope: string,
): Promise<Item> {
  if (item.kind === "asset" && expected === 0) {
    const blob = await local.blob(scope, item.id);
    if (!blob)
      throw new Error(
        "Local file is missing. Remove this draft and upload the file again.",
      );
    const { error } = await supabase!.storage
      .from("machinebook")
      .upload(item.data.path, blob, {
        contentType: item.data.mime,
        upsert: true,
      });
    if (error) throw error;
  }
  const { data, error } = await supabase!.rpc("save_item", {
    p_item: item,
    p_expected: expected,
  });
  if (error) throw error;
  return data as Item;
}
export async function deleteRemote(item: Item, expected: number) {
  const { data, error } = await supabase!.rpc("delete_item", {
    p_id: item.id,
    p_expected: expected,
  });
  if (error) throw error;
  if (data?.length) {
    const { error: storageError } = await supabase!.storage
      .from("machinebook")
      .remove(data);
    if (storageError)
      console.warn("Private orphan files require scheduled cleanup.");
  }
}
export async function fileBlob(scope: string, item: Item): Promise<Blob> {
  const cached = await local.blob(scope, item.id);
  if (cached) return cached;
  if (!supabase || !navigator.onLine)
    throw new Error("This file is not available offline.");
  const { data, error } = await supabase.storage
    .from("machinebook")
    .download(item.data.path);
  if (error) throw error;
  await local.putBlob(scope, item.id, data);
  return data;
}
export async function compressImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use JPEG, PNG or WebP images.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image conversion failed")),
      "image/jpeg",
      0.82,
    ),
  );
}
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
