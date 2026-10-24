import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, GripVertical, Plus, Shapes, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { createPatternFrom, patternHostOf } from "./synced";
import { blockFromPos, currentBlock, deleteBlock, duplicateBlock, insertParagraphAfter, insertParagraphBefore, moveBlock, parentBlock, type BlockRef } from "./blockops";
import type { EditorLabels } from "./labels";
import { cx } from "./util";

const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const key = (s: string) => (mac ? s.replace("Mod", "⌘").replace("Shift", "⇧").replace("Alt", "⌥").replace(/-/g, "") : s.replace("Mod", "Ctrl").replace(/-/g, "+"));

/** Thao tác khối theo phím tắt (cùng chỗ với menu khối). */
export type BlockAction = "up" | "down" | "duplicate" | "delete" | "parent" | "insert" | "insertBefore" | "pattern";

export function runBlockAction(editor: TiptapEditor, action: BlockAction, block = currentBlock(editor.state)): boolean {
  if (!block) return false;
  if (action === "pattern") { void createPatternFrom(editor, block); return true; }
  const { state } = editor;
  const tr = action === "up" ? moveBlock(state, block, -1) : action === "down" ? moveBlock(state, block, 1)
    : action === "duplicate" ? duplicateBlock(state, block) : action === "delete" ? deleteBlock(state, block)
    : action === "insert" ? insertParagraphAfter(state, block)
    : action === "insertBefore" ? insertParagraphBefore(state, block)
    : (() => { const p = parentBlock(state.doc, block); return p ? state.tr.setSelection(NodeSelection.create(state.doc, p.pos)) : null; })();
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

/** Phím tắt thao tác khối + Alt+F10 mở menu khối. */
export const BlockKeys = Extension.create<{ openMenu(): void }>({
  name: "cmsBlockKeys",
  addOptions: () => ({ openMenu: () => {} }),
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": () => runBlockAction(this.editor, "up"),
      "Mod-Shift-ArrowDown": () => runBlockAction(this.editor, "down"),
      "Mod-Shift-d": () => runBlockAction(this.editor, "duplicate"),
      "Mod-Shift-Backspace": () => runBlockAction(this.editor, "delete"),
      "Alt-F10": () => { this.options.openMenu(); return true; },
    };
  },
});

/** Bắt đầu kéo một khối (tay kéo bên trái, nút kéo trên thanh công cụ khối): ProseMirror tự thả + xoá bản gốc. */
export function startBlockDrag(editor: TiptapEditor, block: BlockRef, e: DragEvent) {
  const view = editor.view;
  const sel = NodeSelection.create(view.state.doc, block.pos);
  view.dispatch(view.state.tr.setSelection(sel));
  const slice = sel.content();
  const { dom, text } = view.serializeForClipboard(slice);
  e.dataTransfer.clearData();
  e.dataTransfer.setData("text/html", dom.innerHTML);
  e.dataTransfer.setData("text/plain", text);
  e.dataTransfer.effectAllowed = "copyMove";
  const el = view.nodeDOM(block.pos) as HTMLElement | null;
  if (el) e.dataTransfer.setDragImage(el, 0, 0);
  (view as any).dragging = { slice, move: true, node: sel };
}

type Shown = { block: BlockRef; rect: DOMRect };

/**
 * Tay kéo bên trái khối (khối đang trỏ chuột, không thì khối có con trỏ): kéo để di chuyển, bấm để mở menu
 * (lên, xuống, nhân bản, xoá, chọn khối cha). Nút "+" chèn đoạn văn mới bên dưới và mở slash menu.
 */
export function BlockHandle({ editor, t, menuRequest }: { editor: TiptapEditor; t: EditorLabels; menuRequest: number }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [menu, setMenu] = useState(false);
  const hover = useRef<BlockRef | null>(null);
  const overHandle = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuOpen = useRef(false); menuOpen.current = menu;

  // Tính lại vị trí (cuộn, gõ, đổi khối)
  useEffect(() => {
    const view = editor.view;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (menuOpen.current) return;
        let block = hover.current;
        // Khối đang trỏ chuột có thể đã đổi chỗ / bị xoá sau giao dịch → kiểm lại
        if (block) { const n = editor.state.doc.nodeAt(block.pos); block = n ? blockFromPos(editor.state.doc, block.pos) : null; }
        if (!block && (editor.isFocused || overHandle.current)) block = currentBlock(editor.state);
        const dom = block ? (view.nodeDOM(block.pos) as HTMLElement | null) : null;
        setShown(block && dom?.getBoundingClientRect ? { block, rect: dom.getBoundingClientRect() } : null);
      });
    };
    const onMove = (e: MouseEvent) => {
      const at = view.posAtCoords({ left: e.clientX, top: e.clientY });
      const b = at ? blockFromPos(view.state.doc, at.inside >= 0 ? at.inside : Math.max(0, at.pos - 1)) : null;
      if (b?.pos !== hover.current?.pos) { hover.current = b; update(); }
    };
    const onLeave = () => { setTimeout(() => { if (!overHandle.current) { hover.current = null; update(); } }, 120); };
    const root = view.dom.parentElement ?? view.dom;
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    editor.on("transaction", update); editor.on("focus", update); editor.on("blur", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("mousemove", onMove); root.removeEventListener("mouseleave", onLeave);
      editor.off("transaction", update); editor.off("focus", update); editor.off("blur", update);
      window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update);
    };
  }, [editor]);

  // Alt+F10: mở menu cho khối có con trỏ
  useEffect(() => {
    if (!menuRequest) return;
    const block = currentBlock(editor.state);
    const dom = block ? (editor.view.nodeDOM(block.pos) as HTMLElement | null) : null;
    if (!block || !dom) return;
    hover.current = null;
    setShown({ block, rect: dom.getBoundingClientRect() });
    setMenu(true);
  }, [menuRequest]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", outside, true);
    return () => document.removeEventListener("mousedown", outside, true);
  }, [menu]);

  if (!shown) return null;
  const { block, rect } = shown;
  const $p = editor.state.doc.resolve(Math.min(block.pos, editor.state.doc.content.size));
  const index = $p.index(), count = $p.parent.childCount;
  const hasParent = !!parentBlock(editor.state.doc, block);

  const act = (a: BlockAction) => { setMenu(false); hover.current = null; runBlockAction(editor, a, block); };
  const items: Array<[BlockAction, LucideIcon, string, string | null, boolean]> = [
    ["up", ArrowUp, t.moveUp, key("Mod-Shift-↑"), index > 0],
    ["down", ArrowDown, t.moveDown, key("Mod-Shift-↓"), index < count - 1],
    ["duplicate", Copy, t.duplicate, key("Mod-Shift-D"), true],
    ...(hasParent ? [["parent", CornerLeftUp, t.selectParent, null, true] as [BlockAction, LucideIcon, string, string | null, boolean]] : []),
    ...(patternHostOf(editor)?.create ? [["pattern", Shapes, t.createPattern, null, true] as [BlockAction, LucideIcon, string, string | null, boolean]] : []),
    ["delete", Trash2, t.deleteBlock, key("Mod-Shift-⌫"), true],
  ];

  function onMenuKey(e: KeyboardEvent) {
    const list = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); setMenu(false); editor.view.focus(); }
  }

  function onDragStart(e: DragEvent) {
    startBlockDrag(editor, block, e);
    setMenu(false);
  }

  const top = rect.top + Math.min(rect.height / 2, 14) - 12;
  return createPortal(
    <div ref={ref} className="cms-ed-handle" style={{ top, left: rect.left - 52 }}
      onMouseEnter={() => { overHandle.current = true; }} onMouseLeave={() => { overHandle.current = false; }}>
      <button type="button" className="cms-ed-handle-btn" title={t.addBelow} aria-label={t.addBelow} tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()} onClick={() => { act("insert"); editor.chain().insertContent("/").run(); }}><Plus size={14} /></button>
      <button type="button" className={cx("cms-ed-handle-btn", "is-grip", menu && "is-active")} draggable title={t.blockOptions} aria-label={t.blockOptions}
        aria-haspopup="menu" aria-expanded={menu} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setMenu((m) => !m)} onDragStart={onDragStart} onDragEnd={() => { hover.current = null; }}><GripVertical size={14} /></button>
      {menu && (
        <div ref={menuRef} role="menu" aria-label={t.blockOptions} className="cms-ed-menu" onKeyDown={onMenuKey}>
          {items.map(([a, Icon, label, shortcut, enabled]) => (
            <button key={a} type="button" role="menuitem" tabIndex={-1} disabled={!enabled} className={cx("cms-ed-menu-item", a === "delete" && "is-danger")}
              onClick={() => act(a)}>
              <Icon size={14} /><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
