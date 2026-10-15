import type { EditorExtensionPack } from "./types";

/**
 * Plugin đăng ký thêm khối cho mọi trình soạn trong ứng dụng.
 * Trình soạn đang mở tự nạp lại khi có gói mới.
 */
const packs = new Map<string, EditorExtensionPack>();
const listeners = new Set<() => void>();
// Snapshot bất biến (useSyncExternalStore yêu cầu cùng một tham chiếu khi dữ liệu không đổi)
let snapshot: EditorExtensionPack[] = [];

function changed() {
  snapshot = [...packs.values()];
  listeners.forEach((l) => l());
}

export function registerEditorExtension(pack: EditorExtensionPack) { packs.set(pack.name, pack); changed(); }
export function unregisterEditorExtension(name: string) { if (packs.delete(name)) changed(); }
export function registeredExtensions(): EditorExtensionPack[] { return snapshot; }
export function onExtensionsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
