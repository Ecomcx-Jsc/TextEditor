import type { Editor as TiptapEditor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, ChevronDown, Copy, CornerLeftUp, GripVertical, Heading2, Heading3, Heading4,
  IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered, Maximize2, MoreVertical, Pilcrow, Quote, SquareCode, Trash2, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { askOf } from "./ask";
import { blockInfo } from "./blockMeta";
import { currentBlock, parentBlock, type BlockRef } from "./blockops";
import { runBlockAction, startBlockDrag, type BlockAction } from "./handle";
import type { EditorLabels } from "./labels";
import { LAYOUT_TYPES } from "./layoutUi";
import { imageAttrs } from "./media";
import type { MediaKind, MediaProvider } from "./types";
import { cx } from "./util";

type RequestMedia = (editor: TiptapEditor, kind: MediaKind) => void;
const TEXT = new Set(["paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock"]);

function Btn({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cx("cms-ed-btn", active && "is-active")}>{children}</button>
  );
}
const Sep = () => <span className="cms-ed-sep" />;

/** Menu thả xuống nhỏ của thanh công cụ (đổi loại khối, tuỳ chọn khác). */
function Menu({ label, icon, items, close }: { label: string; icon: ReactNode; items: Array<{ key: string; icon: LucideIcon; label: string; run(): void; disabled?: boolean; danger?: boolean; active?: boolean }>; close?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => setOpen(false), [close]);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside, true);
    return () => document.removeEventListener("mousedown", outside, true);
  }, [open]);
  return (
    <span ref={ref} className="cms-ed-blockbar-menu">
      <button type="button" className={cx("cms-ed-btn", "is-wide", open && "is-active")} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}>{icon}</button>
      {open && (
        <div role="menu" aria-label={label} className="cms-ed-menu" onKeyDown={(e) => {
          const list = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])];
          const i = list.indexOf(document.activeElement as HTMLElement);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus(); }
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
        }}>
          {items.map((it) => (
            <button key={it.key} type="button" role="menuitem" tabIndex={-1} disabled={it.disabled} aria-current={it.active || undefined}
              className={cx("cms-ed-menu-item", it.danger && "is-danger", it.active && "is-active")} onClick={() => { setOpen(false); it.run(); }}>
              <it.icon size={14} /><span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Chọn trọn khối rồi đổi loại (đoạn văn ↔ tiêu đề ↔ danh sách ↔ trích dẫn ↔ khối mã). */
function transform(editor: TiptapEditor, block: BlockRef, to: string) {
  const c = editor.chain().focus().setTextSelection({ from: block.pos + 1, to: block.pos + block.node.nodeSize - 1 }).clearNodes();
  switch (to) {
    case "h2": case "h3": case "h4": c.setHeading({ level: Number(to[1]) as 2 | 3 | 4 }); break;
    case "bulletList": c.toggleBulletList(); break;
    case "orderedList": c.toggleOrderedList(); break;
    case "blockquote": c.toggleBlockquote(); break;
    case "codeBlock": c.toggleCodeBlock(); break;
  }
  c.run();
  // Thu vùng chọn về cuối khối (vùng chọn chữ sẽ ẩn thanh công cụ)
  editor.commands.setTextSelection(editor.state.selection.to);
}

/** Nút riêng của ảnh: cỡ, căn lề, alt, chú thích, thay ảnh, cỡ gốc. */
function ImageTools({ editor, t, media, requestMedia }: { editor: TiptapEditor; t: EditorLabels; media?: MediaProvider; requestMedia: RequestMedia }) {
  const attrs = useEditorState({ editor, selector: ({ editor: e }) => (e.isActive("image") ? { ...e.getAttributes("image") } : null) });
  if (!attrs) return null;
  const set = (a: Record<string, unknown>) => editor.chain().focus().updateAttributes("image", a).run();
  async function resize(size: string) {
    if (!attrs?.mediaId || !media?.get) return set({ size });
    const m = await media.get(attrs.mediaId).catch(() => null);
    set(m ? { ...imageAttrs(m, size), alt: attrs.alt, caption: attrs.caption, align: attrs.align } : { size });
  }
  const aligns: Array<[string | null, LucideIcon, string]> = [["left", AlignLeft, t.floatLeft], [null, AlignCenter, t.center], ["right", AlignRight, t.floatRight], ["wide", Maximize2, t.wide]];
  const ask = async (title: string, label: string, key: "alt" | "caption") => {
    const r = await askOf(editor)({ title, fields: [{ key: "v", label, type: "textarea", value: attrs[key] ?? "" }] });
    if (r && r !== "remove") set({ [key]: String(r.v) || (key === "caption" ? null : "") });
  };
  return (
    <>
      {attrs.mediaId != null && media?.get && (
        <select className="cms-ed-select" value={attrs.size ?? "large"} onChange={(e) => resize(e.target.value)} title={t.size} aria-label={t.size}>
          {([["medium", t.sizeMedium], ["medium_large", t.sizeMediumLarge], ["large", t.sizeLarge], ["full", t.sizeFull]] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {aligns.map(([v, Icon, title]) => <Btn key={title} title={title} active={(attrs.align ?? null) === v} onClick={() => set({ align: v })}><Icon size={16} /></Btn>)}
      <Sep />
      <button type="button" className="cms-ed-text-btn" onClick={() => ask(t.alt, t.altPrompt, "alt")}>{t.alt}</button>
      <button type="button" className="cms-ed-text-btn" onClick={() => ask(t.caption, t.captionPrompt, "caption")}>{t.caption}</button>
      <button type="button" className="cms-ed-text-btn" onClick={() => requestMedia(editor, "image")}>{t.replace}</button>
      {attrs.mediaId != null && media?.get && <button type="button" className="cms-ed-text-btn" onClick={() => resize(attrs.size ?? "large")}>{t.resetSize}</button>}
    </>
  );
}

/** Nút riêng theo loại khối. */
function BlockTools({ editor, block, t, media, requestMedia }: { editor: TiptapEditor; block: BlockRef; t: EditorLabels; media?: MediaProvider; requestMedia: RequestMedia }) {
  const s = useEditorState({ editor, selector: ({ editor: e }) => ({
    left: e.isActive({ textAlign: "left" }), center: e.isActive({ textAlign: "center" }), right: e.isActive({ textAlign: "right" }),
    bold: e.isActive("bold"), italic: e.isActive("italic"), link: e.isActive("link"), header: e.isActive("tableHeader"),
  }) });
  const c = () => editor.chain().focus();
  const type = block.node.type.name;
  const parts: ReactNode[] = [];
  if (type === "paragraph" || type === "heading") parts.push(
    <span key="align" role="group" aria-label={t.textAlign} className="cms-ed-blockbar-group">
      <Btn title={t.alignLeft} active={s.left} onClick={() => c().setTextAlign("left").run()}><AlignLeft size={16} /></Btn>
      <Btn title={t.alignCenter} active={s.center} onClick={() => c().setTextAlign("center").run()}><AlignCenter size={16} /></Btn>
      <Btn title={t.alignRight} active={s.right} onClick={() => c().setTextAlign("right").run()}><AlignRight size={16} /></Btn>
    </span>);
  if (type === "bulletList" || type === "orderedList" || type === "taskList") {
    const item = type === "taskList" ? "taskItem" : "listItem";
    parts.push(
      <span key="indent" role="group" aria-label={t.listIndent} className="cms-ed-blockbar-group">
        <Btn title={t.outdent} onClick={() => c().liftListItem(item).run()}><IndentDecrease size={16} /></Btn>
        <Btn title={t.indent} onClick={() => c().sinkListItem(item).run()}><IndentIncrease size={16} /></Btn>
      </span>);
  }
  if (TEXT.has(type) && type !== "codeBlock") parts.push(
    <span key="marks" role="group" aria-label={t.formatting} className="cms-ed-blockbar-group">
      <Btn title={t.bold} active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn title={t.italic} active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn title={t.link} active={s.link} onClick={() => (editor.storage as any).cmsEditorContext?.setLink?.()}><Link2 size={16} /></Btn>
    </span>);
  if (type === "image") parts.push(<span key="image" role="group" aria-label={t.image} className="cms-ed-blockbar-group"><ImageTools editor={editor} t={t} media={media} requestMedia={requestMedia} /></span>);
  if (type === "table") parts.push(
    <span key="table" role="group" aria-label={t.table} className="cms-ed-table-tools">
      {([[t.addRow, () => c().addRowAfter().run()], [t.addCol, () => c().addColumnAfter().run()], [t.delRow, () => c().deleteRow().run()], [t.delCol, () => c().deleteColumn().run()],
        [t.headerRow, () => c().toggleHeaderRow().run()]] as const).map(([l, f]) => <button key={l} type="button" onMouseDown={(e) => e.preventDefault()} onClick={f}>{l}</button>)}
      <button type="button" className="is-danger" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()}>{t.delTable}</button>
    </span>);
  return <>{parts.flatMap((p, i) => (i ? [<Sep key={`s${i}`} />, p] : [p]))}</>;
}

/**
 * Thanh công cụ nổi phía trên khối đang chọn: loại khối (bấm để đổi loại), kéo, lên/xuống, nút riêng theo khối
 * (căn chữ, thụt danh sách, định dạng, ảnh, bảng), menu ⋮ (thêm khối trên/dưới, nhân bản, chọn khối cha, xoá).
 * Ẩn khi đang gõ chữ, hiện lại khi rê chuột / bấm.
 */
export function BlockToolbar({ editor, t, media, requestMedia }: { editor: TiptapEditor; t: EditorLabels; media?: MediaProvider; requestMedia: RequestMedia }) {
  const block = useEditorState({ editor, selector: ({ editor: e }) => {
    const sel = e.state.selection;
    if (!sel.empty && !(sel instanceof NodeSelection) && !e.isActive("image")) return null; // đang bôi đen chữ → menu định dạng
    return currentBlock(e.state);
  }, equalityFn: (a, b) => a?.pos === b?.pos && a?.node === b?.node });
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(editor.isFocused);
  const [typing, setTyping] = useState(false);
  const [inside, setInside] = useState(false);

  useEffect(() => {
    const f = () => setVisible(true), b = () => setVisible(false);
    const key = (e: KeyboardEvent) => { if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) setTyping(true); };
    const move = () => setTyping(false);
    const dom = editor.view.dom;
    editor.on("focus", f); editor.on("blur", b);
    dom.addEventListener("keydown", key); dom.addEventListener("mousedown", move); document.addEventListener("mousemove", move);
    return () => { editor.off("focus", f); editor.off("blur", b); dom.removeEventListener("keydown", key); dom.removeEventListener("mousedown", move); document.removeEventListener("mousemove", move); };
  }, [editor]);

  useEffect(() => {
    if (!block) { setRect(null); return; }
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(block.pos) as HTMLElement | null;
      setRect(dom?.getBoundingClientRect ? dom.getBoundingClientRect() : null);
    }); };
    update();
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); editor.off("transaction", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor, block?.pos, block?.node]);

  if (!block || !rect || !(visible || inside) || (typing && !inside)) return null;
  const type = block.node.type.name;
  // Khối bố cục khi không có tab "Khối": thanh cài đặt riêng của nó đã nằm đúng chỗ này
  const inspector = ((editor.storage as any).cmsEditorContext?.inspector ?? 0) > 0;
  if (LAYOUT_TYPES.has(type) && !inspector && editor.state.selection instanceof NodeSelection) return null;

  const info = blockInfo(type, t);
  const $p = editor.state.doc.resolve(Math.min(block.pos, editor.state.doc.content.size));
  const index = $p.index(), count = $p.parent.childCount;
  const act = (a: BlockAction) => runBlockAction(editor, a, block);
  const head = type === "heading" ? `h${block.node.attrs.level}` : type;
  const transforms: Array<[string, LucideIcon, string]> = [
    ["paragraph", Pilcrow, t.paragraph], ["h2", Heading2, t.h2], ["h3", Heading3, t.h3], ["h4", Heading4, t.h4],
    ["bulletList", List, t.bulletList], ["orderedList", ListOrdered, t.orderedList], ["blockquote", Quote, t.quote], ["codeBlock", SquareCode, t.codeBlock],
  ];
  const top = rect.top - 46 < 8 ? rect.bottom + 6 : rect.top - 46;
  return createPortal(
    <div ref={ref} role="toolbar" aria-label={t.blockToolbar} className="cms-ed-blockbar" style={{ top, left: Math.max(8, rect.left) }}
      onMouseEnter={() => setInside(true)} onMouseLeave={() => { if (!ref.current?.contains(document.activeElement)) setInside(false); }}
      onFocus={() => setInside(true)} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setInside(false); }}>
      <span role="group" aria-label={info.title} className="cms-ed-blockbar-group">
        {TEXT.has(type)
          ? <Menu label={`${info.title} — ${t.transformTo}`} icon={<><info.icon size={16} /><ChevronDown size={12} /></>}
              items={transforms.map(([k, icon, label]) => ({ key: k, icon, label, active: k === head, run: () => transform(editor, block, k) }))} />
          : <span className="cms-ed-blockbar-type" title={info.title}><info.icon size={16} /></span>}
        <button type="button" className="cms-ed-btn is-grip" draggable title={t.blockOptions} aria-label={t.blockOptions} onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => startBlockDrag(editor, block, e)}><GripVertical size={14} /></button>
        <span className="cms-ed-blockbar-mover">
          <button type="button" title={t.moveUp} aria-label={t.moveUp} disabled={index === 0} onMouseDown={(e) => e.preventDefault()} onClick={() => act("up")}><ArrowUp size={12} /></button>
          <button type="button" title={t.moveDown} aria-label={t.moveDown} disabled={index >= count - 1} onMouseDown={(e) => e.preventDefault()} onClick={() => act("down")}><ArrowDown size={12} /></button>
        </span>
      </span>
      <Sep />
      <BlockTools editor={editor} block={block} t={t} media={media} requestMedia={requestMedia} />
      <Sep />
      <Menu label={t.moreOptions} icon={<MoreVertical size={16} />} items={[
        { key: "before", icon: ArrowUp, label: t.insertBefore, run: () => act("insertBefore") },
        { key: "after", icon: ArrowDown, label: t.addBelow, run: () => act("insert") },
        { key: "dup", icon: Copy, label: t.duplicate, run: () => act("duplicate") },
        ...(parentBlock(editor.state.doc, block) ? [{ key: "parent", icon: CornerLeftUp, label: t.selectParent, run: () => act("parent") }] : []),
        { key: "del", icon: Trash2, label: t.deleteBlock, danger: true, run: () => act("delete") },
      ]} />
    </div>,
    document.body,
  );
}
