import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { EditorLabels } from "./labels";
import { cx } from "./util";

/**
 * Hộp nhập nhỏ đặt cạnh chỗ đang soạn (thay window.prompt): link, alt, chú thích, YouTube, shortcode, cài đặt khối.
 * Enter = áp dụng, Esc / bấm ra ngoài = huỷ, Tab không thoát khỏi hộp; đóng xong con trỏ về trình soạn.
 */
export interface AskField {
  key: string;
  label: string;
  value?: string | boolean;
  type?: "text" | "url" | "textarea" | "checkbox" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface AskOptions {
  title: string;
  fields: AskField[];
  /** Chữ nút áp dụng (mặc định labels.apply). */
  submit?: string;
  /** Có → hiện nút phụ (vd "Gỡ liên kết"); bấm trả về "remove". */
  remove?: string;
  /** Vị trí neo (mặc định: chỗ con trỏ). */
  anchor?: { left: number; top: number; bottom: number };
}

export type AskResult = Record<string, string | boolean> | "remove" | null;
export type Ask = (opts: AskOptions) => Promise<AskResult>;

type AskState = { opts: AskOptions; resolve(r: AskResult): void } | null;

export function createAskStore() {
  let state: AskState = null;
  const listeners = new Set<() => void>();
  const set = (s: AskState) => { state = s; listeners.forEach((l) => l()); };
  return {
    get: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    ask: ((opts) => new Promise<AskResult>((resolve) => { state?.resolve(null); set({ opts, resolve }); })) as Ask,
    close(r: AskResult) { const s = state; set(null); s?.resolve(r); },
  };
}
export type AskStore = ReturnType<typeof createAskStore>;

/** Hàm hỏi của trình soạn (để node view / gói mở rộng dùng chung một kiểu hộp nhập). */
export const askOf = (editor: TiptapEditor): Ask => (editor.storage as any).cmsEditorContext?.ask ?? (async () => null);

function anchorOf(editor: TiptapEditor) {
  try {
    const c = editor.view.coordsAtPos(editor.state.selection.from);
    return { left: c.left, top: c.top, bottom: c.bottom };
  } catch {
    const r = editor.view.dom.getBoundingClientRect();
    return { left: r.left + 16, top: r.top, bottom: r.top + 24 };
  }
}

const FOCUSABLE = "input, select, textarea, button:not(:disabled)";

export function AskPopover({ store, editor, t }: { store: AskStore; editor: TiptapEditor; t: EditorLabels }) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  if (!state) return null;
  // key: mở hộp mới → làm mới giá trị
  return <AskForm key={state.opts.title + state.opts.fields.map((f) => f.key).join()} state={state} store={store} editor={editor} t={t} />;
}

function AskForm({ state, store, editor, t }: { state: NonNullable<AskState>; store: AskStore; editor: TiptapEditor; t: EditorLabels }) {
  const { opts } = state;
  const id = useId();
  const ref = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(opts.fields.map((f) => [f.key, f.value ?? (f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0]?.value ?? "" : "")])));
  const [anchor] = useState(() => opts.anchor ?? anchorOf(editor));
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const close = (r: AskResult) => { store.close(r); editor.commands.focus(); };

  // Đặt dưới chỗ neo; không đủ chỗ thì lên trên; luôn nằm trong màn hình
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8));
    const below = anchor.bottom + 8;
    const top = below + h > window.innerHeight - 8 && anchor.top - h - 8 > 8 ? anchor.top - h - 8 : Math.max(8, Math.min(below, window.innerHeight - h - 8));
    setPos({ left, top });
  }, [anchor]);

  // Focus khi hộp đã hiện (lúc còn ẩn để đo kích thước thì không nhận focus)
  const focused = useRef(false);
  useEffect(() => {
    if (!pos || focused.current) return;
    focused.current = true;
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    if (first instanceof HTMLInputElement && first.type !== "checkbox") first.select();
  }, [pos]);

  useEffect(() => {
    const outside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(null); };
    // Esc huỷ cả khi focus không nằm trong hộp
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); } };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", outside, true); document.removeEventListener("keydown", esc, true); };
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
      e.preventDefault(); items[next].focus();
    }
  }

  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));
  return createPortal(
    <form ref={ref} role="dialog" aria-labelledby={`${id}-title`} className="cms-ed-ask" onKeyDown={onKeyDown}
      style={pos ? { left: pos.left, top: pos.top } : { left: anchor.left, top: anchor.bottom + 8, visibility: "hidden" }}
      onSubmit={(e) => { e.preventDefault(); close(values); }}>
      <div id={`${id}-title`} className="cms-ed-ask-title">{opts.title}</div>
      {opts.fields.map((f) => {
        const fid = `${id}-${f.key}`;
        if (f.type === "checkbox") return (
          <label key={f.key} className="cms-ed-ask-check" htmlFor={fid}>
            <input id={fid} type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
          </label>
        );
        return (
          <label key={f.key} className="cms-ed-ask-field" htmlFor={fid}>
            <span>{f.label}</span>
            {f.type === "textarea" ? <textarea id={fid} rows={3} value={String(values[f.key])} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(values); } }} />
              : f.type === "select" ? <select id={fid} value={String(values[f.key])} onChange={(e) => set(f.key, e.target.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : <input id={fid} type={f.type === "url" ? "url" : "text"} value={String(values[f.key])} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
          </label>
        );
      })}
      <div className="cms-ed-ask-actions">
        {opts.remove && <button type="button" className={cx("cms-ed-ask-btn", "is-danger")} onClick={() => close("remove")}>{opts.remove}</button>}
        <span className="cms-ed-ask-spacer" />
        <button type="button" className="cms-ed-ask-btn" onClick={() => close(null)}>{t.cancel}</button>
        <button type="submit" className={cx("cms-ed-ask-btn", "is-primary")}>{opts.submit ?? t.apply}</button>
      </div>
    </form>,
    document.body,
  );
}
