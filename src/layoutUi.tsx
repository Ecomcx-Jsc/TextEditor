import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { NodeSelection, TextSelection, type EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { embedInfo } from "@ecomcx/nexus-content";
import { AlignCenter, AlignLeft, AlignRight, Columns2, Columns3, Globe, Info, Pencil, RectangleHorizontal, SquareDashed } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { askOf } from "./ask";
import { setBlockAttrs } from "./blockops";
import { insertBlock } from "./insert";
export { insertBlock } from "./insert";
import type { EditorLabels } from "./labels";
import { COLUMN_PRESETS, emptyColumn, safeColor, setColumnCount, setColumnWidths } from "./layout";
import type { InsertItem } from "./types";
import { cx } from "./util";

// ---------------------------------------------------------------------------
// Lệnh chèn (slash menu)
// ---------------------------------------------------------------------------
const start = (e: TiptapEditor, r?: { from: number; to: number }) => (r ? e.chain().focus().deleteRange(r) : e.chain().focus());

/** Chèn khối chứa rồi đặt con trỏ vào đoạn văn đầu tiên bên trong. */
function insertContainer(e: TiptapEditor, r: { from: number; to: number } | undefined, node: Record<string, unknown>) {
  start(e, r).run();
  insertBlock(e, node);
  // Con trỏ vào đoạn văn đầu tiên của khối vừa chèn (insertContent để con trỏ sau khối)
  // = khối cùng loại bắt đầu gần nhất trước con trỏ
  const { state } = e;
  let target = -1;
  state.doc.descendants((n, pos) => { if (n.type.name === node.type && pos < state.selection.from && pos > target) target = pos; });
  const found = target >= 0 ? TextSelection.findFrom(state.doc.resolve(target + 1), 1, true) : null;
  if (found) e.view.dispatch(state.tr.setSelection(found).scrollIntoView());
}

export async function editButton(e: TiptapEditor, t: EditorLabels, current: Record<string, any> = {}) {
  const r = await askOf(e)({ title: t.button, submit: current.text ? t.apply : t.insert, fields: [
    { key: "text", label: t.buttonText, value: current.text ?? "" },
    { key: "href", label: t.buttonUrl, type: "url", value: current.href ?? "", placeholder: "https://" },
    { key: "blank", label: t.linkNewTab, type: "checkbox", value: current.target === "_blank" },
  ] });
  if (!r || r === "remove") return null;
  return { text: String(r.text).trim() || null, href: String(r.href).trim() || null, target: r.blank ? "_blank" : null };
}

export async function editEmbed(e: TiptapEditor, t: EditorLabels, current: Record<string, any> = {}) {
  const r = await askOf(e)({ title: t.embed, submit: current.url ? t.apply : t.insert, fields: [
    { key: "url", label: t.embedUrl, type: "url", value: current.url ?? "", placeholder: "https://" },
    { key: "caption", label: t.caption, value: current.caption ?? "" },
  ] });
  if (!r || r === "remove" || !String(r.url).trim()) return null;
  return { url: String(r.url).trim(), caption: String(r.caption).trim() || null };
}

export function layoutItems(t: EditorLabels): InsertItem[] {
  return [
    { key: "columns2", title: t.columns2, hint: t.columnsHint, icon: Columns2, keywords: "cot columns layout bo cuc 2",
      run: (e, r) => insertContainer(e, r, { type: "columns", content: [emptyColumn(), emptyColumn()] }) },
    { key: "columns3", title: t.columns3, hint: t.columnsHint, icon: Columns3, keywords: "cot columns layout bo cuc 3",
      run: (e, r) => insertContainer(e, r, { type: "columns", content: [emptyColumn(), emptyColumn(), emptyColumn()] }) },
    { key: "group", title: t.group, hint: t.groupHint, icon: SquareDashed, keywords: "nhom group khung section nen",
      run: (e, r) => insertContainer(e, r, { type: "group", attrs: { padding: "medium" }, content: [{ type: "paragraph" }] }) },
    { key: "callout", title: t.callout, hint: t.calloutHint, icon: Info, keywords: "hop luu y callout canh bao note thong tin",
      run: (e, r) => insertContainer(e, r, { type: "callout", attrs: { tone: "info" }, content: [{ type: "paragraph" }] }) },
    { key: "button", title: t.button, hint: t.buttonHint, icon: RectangleHorizontal, keywords: "nut button lien ket cta",
      run: async (e, r) => {
        start(e, r).run();
        const a = await editButton(e, t);
        if (a?.text) insertBlock(e, { type: "button", attrs: { ...a, variant: "primary" } });
      } },
    { key: "embed", title: t.embed, hint: t.embedHint, icon: Globe, keywords: "nhung embed oembed video vimeo spotify tiktok twitter x instagram soundcloud codepen figma map ban do",
      run: async (e, r) => {
        start(e, r).run();
        const a = await editEmbed(e, t);
        if (a) insertBlock(e, { type: "embed", attrs: a });
      } },
  ];
}

// ---------------------------------------------------------------------------
// Thanh cài đặt khối: hiện phía trên khối bố cục đang có con trỏ / đang chọn
// ---------------------------------------------------------------------------
const TYPES = new Set(["columns", "group", "callout", "button", "embed"]);

type Target = { pos: number; node: PMNode };

function settingsTarget(state: EditorState): Target | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection) return TYPES.has(sel.node.type.name) ? { pos: sel.from, node: sel.node } : null;
  if (!sel.empty) return null; // đang bôi đen chữ → menu định dạng
  const $f = sel.$from;
  for (let d = $f.depth; d > 0; d--) if (TYPES.has($f.node(d).type.name)) return { pos: $f.before(d), node: $f.node(d) };
  return null;
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T | null; options: Array<[T, ReactNode, string]>; onChange(v: T): void; label: string }) {
  return (
    <span role="group" aria-label={label} className="cms-ed-seg">
      {options.map(([v, content, title]) => (
        <button key={v} type="button" title={title} aria-label={title} aria-pressed={value === v} className={cx("cms-ed-seg-btn", value === v && "is-active")}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(v)}>{content}</button>
      ))}
    </span>
  );
}

function ColorField({ value, onChange, label, t }: { value: string | null; onChange(v: string | null): void; label: string; t: EditorLabels }) {
  return (
    <span className="cms-ed-color">
      <label className="cms-ed-color-label">
        <span>{label}</span>
        <input type="color" aria-label={label} value={safeColor(value)?.startsWith("#") && value!.length === 7 ? value! : "#ffffff"} onChange={(e) => onChange(e.target.value)} />
      </label>
      {value && <button type="button" className="cms-ed-text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(null)}>{t.noColor}</button>}
    </span>
  );
}

/** Cài đặt của khối bố cục (cột, nhóm, hộp lưu ý, nút, nhúng) — dùng ở thanh nổi và ở tab "Khối". null = loại khối khác. */
export function LayoutSettings({ editor, pos, node, t, anchor }: { editor: TiptapEditor; pos: number; node: PMNode; t: EditorLabels; anchor?(): { left: number; top: number; bottom: number } | undefined }) {
  const a = node.attrs as Record<string, any>;
  const set = (attrs: Record<string, unknown>) => {
    const tr = setBlockAttrs(editor.state, pos, attrs);
    if (tr) editor.view.dispatch(tr);
  };

  let body: ReactNode = null;
  switch (node.type.name) {
    case "columns": {
      const widths = Array.from({ length: node.childCount }, (_, i) => Number(node.child(i).attrs.width) || 0);
      const current = widths.every((w) => w > 0) ? widths.join("/") : null;
      body = <>
        <Seg label={t.layout} value={current} onChange={(v) => setColumnWidths(editor, pos, v.split("/").map(Number))}
          options={(COLUMN_PRESETS[node.childCount] ?? []).map((p) => [p.join("/"), p.join(" / "), p.join(" / ")] as [string, ReactNode, string])} />
        <button type="button" className="cms-ed-text-btn" disabled={node.childCount >= 4} onMouseDown={(e) => e.preventDefault()} onClick={() => setColumnCount(editor, pos, node.childCount + 1)}>{t.addColumn}</button>
        <button type="button" className="cms-ed-text-btn" disabled={node.childCount <= 2} onMouseDown={(e) => e.preventDefault()} onClick={() => setColumnCount(editor, pos, node.childCount - 1)}>{t.removeColumn}</button>
        <Seg label={t.vAlign} value={a.verticalAlign ?? "top"} onChange={(v) => set({ verticalAlign: v === "top" ? null : v })}
          options={[["top", t.vTop, t.vTop], ["center", t.vCenter, t.vCenter], ["bottom", t.vBottom, t.vBottom]]} />
        <label className="cms-ed-check"><input type="checkbox" checked={a.stack !== false} onChange={(e) => set({ stack: e.target.checked })} /> {t.stack}</label>
      </>;
      break;
    }
    case "group":
      body = <>
        <ColorField label={t.background} value={a.background} onChange={(v) => set({ background: v })} t={t} />
        <ColorField label={t.textColor} value={a.textColor} onChange={(v) => set({ textColor: v })} t={t} />
        <Seg label={t.padding} value={a.padding ?? "medium"} onChange={(v) => set({ padding: v })}
          options={[["none", t.padNone, t.padNone], ["small", t.padSmall, t.padSmall], ["medium", t.padMedium, t.padMedium], ["large", t.padLarge, t.padLarge]]} />
      </>;
      break;
    case "callout":
      body = <>
        <Seg label={t.tone} value={a.tone ?? "info"} onChange={(v) => set({ tone: v })}
          options={[["info", t.toneInfo, t.toneInfo], ["success", t.toneSuccess, t.toneSuccess], ["warning", t.toneWarning, t.toneWarning], ["danger", t.toneDanger, t.toneDanger]]} />
        <button type="button" className="cms-ed-text-btn" onMouseDown={(e) => e.preventDefault()} onClick={async () => {
          const r = await askOf(editor)({ title: t.calloutTitle, anchor: anchor?.(), fields: [{ key: "v", label: t.calloutTitle, value: a.title ?? "" }] });
          if (r && r !== "remove") set({ title: String(r.v).trim() || null });
        }}>{t.calloutTitle}</button>
      </>;
      break;
    case "button":
      body = <>
        <button type="button" className="cms-ed-text-btn" onMouseDown={(e) => e.preventDefault()} onClick={async () => { const v = await editButton(editor, t, a); if (v?.text) set(v); }}>
          <Pencil size={12} /> {t.edit}
        </button>
        <Seg label={t.variant} value={a.variant ?? "primary"} onChange={(v) => set({ variant: v })}
          options={[["primary", t.variantPrimary, t.variantPrimary], ["secondary", t.variantSecondary, t.variantSecondary], ["outline", t.variantOutline, t.variantOutline]]} />
        <Seg label={t.alignLeft} value={a.align ?? "left"} onChange={(v) => set({ align: v === "left" ? null : v })}
          options={[["left", <AlignLeft size={14} />, t.alignLeft], ["center", <AlignCenter size={14} />, t.alignCenter], ["right", <AlignRight size={14} />, t.alignRight]]} />
      </>;
      break;
    case "embed":
      body = <>
        <span className="cms-ed-bar-note">{embedInfo(a.url)?.title ?? t.embedUnsupported}</span>
        <button type="button" className="cms-ed-text-btn" onMouseDown={(e) => e.preventDefault()} onClick={async () => { const v = await editEmbed(editor, t, a); if (v) set(v); }}>
          <Pencil size={12} /> {t.edit}
        </button>
      </>;
      break;
  }

  return body;
}

export const LAYOUT_TYPES = TYPES;

export function BlockSettingsBar({ editor, t }: { editor: TiptapEditor; t: EditorLabels }) {
  const target = useEditorState({ editor, selector: ({ editor: e }) => settingsTarget(e.state), equalityFn: (a, b) => a?.pos === b?.pos && a?.node === b?.node });
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [inside, setInside] = useState(false);
  const [focused, setFocused] = useState(editor.isFocused);

  useEffect(() => {
    const f = () => setFocused(true), b = () => setFocused(false);
    editor.on("focus", f); editor.on("blur", b);
    return () => { editor.off("focus", f); editor.off("blur", b); };
  }, [editor]);

  useEffect(() => {
    if (!target) { setRect(null); return; }
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(target.pos) as HTMLElement | null;
      setRect(dom?.getBoundingClientRect ? dom.getBoundingClientRect() : null);
    }); };
    update();
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); editor.off("transaction", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor, target?.pos, target?.node]);

  if (!target || !rect || !(focused || inside)) return null;
  // Có tab "Khối" (BlockInspector) → cài đặt nằm ở đó, không hiện thanh nổi
  if (((editor.storage as any).cmsEditorContext?.inspector ?? 0) > 0) return null;
  const anchor = () => { const r = ref.current?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, bottom: r.bottom } : undefined; };
  const top = rect.top - 44 < 8 ? rect.top + 6 : rect.top - 44;
  return createPortal(
    <div ref={ref} role="toolbar" aria-label={t.blockSettings} className="cms-ed-bar" style={{ top, left: Math.max(8, rect.left) }}
      onFocus={() => setInside(true)} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setInside(false); }}
      onMouseEnter={() => setInside(true)} onMouseLeave={() => { if (!ref.current?.contains(document.activeElement)) setInside(false); }}>
      <LayoutSettings editor={editor} pos={target.pos} node={target.node} t={t} anchor={anchor} />
    </div>,
    document.body,
  );
}
