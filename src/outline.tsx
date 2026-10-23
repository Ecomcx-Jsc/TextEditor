import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { embedInfo } from "@cms/content";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { blockInfo } from "./blockMeta";
import { blockTree, currentBlock, moveBlockTo, type BlockTreeItem } from "./blockops";
import { viLabels, type EditorLabels } from "./labels";
import { labelsOf } from "./nodes";
import { cx } from "./util";

/** Mô tả ngắn của khối trong cây (chữ đầu, alt ảnh, đường dẫn nhúng…). */
function preview(node: PMNode): string {
  const a = node.attrs as Record<string, any>;
  if (node.type.name === "embed") return embedInfo(a.url)?.title ?? a.url ?? "";
  if (node.type.name === "button") return a.text ?? "";
  if (node.type.name === "image") return a.alt || a.caption || "";
  return node.textBetween(0, node.content.size, " ", " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

type Row = BlockTreeItem & { parent: number | null };

/** Chọn khối từ cây: khối chữ → con trỏ ở cuối khối; khối khác → chọn cả khối. */
function selectBlock(editor: TiptapEditor, item: BlockTreeItem, focus: boolean) {
  const { state } = editor;
  const sel = item.node.isTextblock ? TextSelection.create(state.doc, item.pos + item.node.nodeSize - 1) : NodeSelection.create(state.doc, item.pos);
  editor.view.dispatch(state.tr.setSelection(sel).scrollIntoView());
  if (focus) editor.view.focus();
}

/**
 * Cây khối của bài: khối lồng trong cột / nhóm / hộp lưu ý thụt vào; bấm để chọn,
 * kéo thả để đổi chỗ (cả vào / ra khỏi vùng chứa), mũi tên lên/xuống để đi, ←/→ để thu/mở, Enter để vào khối.
 */
export function BlockTree({ editor, labels }: { editor: TiptapEditor; labels?: Partial<EditorLabels> }) {
  const t = { ...viLabels, ...labelsOf(editor), ...labels };
  const data = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ tree: blockTree(e.state.doc), current: currentBlock(e.state)?.pos ?? -1, doc: e.state.doc }),
    equalityFn: (a, b) => a?.doc === b?.doc && a?.current === b?.current,
  });
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [drop, setDrop] = useState<{ pos: number; where: "before" | "after" } | null>(null);
  const dragging = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [focusPos, setFocusPos] = useState<number | null>(null);

  // Danh sách dòng đang hiện (bỏ con của mục đã thu gọn)
  const rows: Row[] = [];
  const flatten = (items: BlockTreeItem[], parent: number | null) => {
    for (const it of items) {
      rows.push({ ...it, parent });
      if (it.children.length && !collapsed.has(it.pos)) flatten(it.children, it.pos);
    }
  };
  flatten(data.tree, null);
  if (!rows.length) return <div className="cms-ed-outline"><p className="cms-ed-inspector-empty">{t.outlineEmpty}</p></div>;
  const active = focusPos ?? (rows.some((r) => r.pos === data.current) ? data.current : rows[0].pos);

  const toggle = (pos: number) => setCollapsed((c) => { const n = new Set(c); if (n.has(pos)) n.delete(pos); else n.add(pos); return n; });
  const focusRow = (pos: number) => { setFocusPos(pos); requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-pos="${pos}"]`)?.focus()); };

  function onKey(e: KeyboardEvent, row: Row, i: number) {
    const go = (j: number) => { e.preventDefault(); const r = rows[Math.max(0, Math.min(rows.length - 1, j))]; focusRow(r.pos); selectBlock(editor, r, false); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(rows.length - 1);
    else if (e.key === "ArrowRight" && row.children.length) { e.preventDefault(); if (collapsed.has(row.pos)) toggle(row.pos); else go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (row.children.length && !collapsed.has(row.pos)) toggle(row.pos); else if (row.parent != null) focusRow(row.parent); }
    else if (e.key === "Enter") { e.preventDefault(); selectBlock(editor, row, true); }
  }

  function onDragOver(e: DragEvent, row: Row) {
    if (dragging.current == null || dragging.current === row.pos) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const where = e.clientY < r.top + r.height / 2 ? "before" : "after";
    if (drop?.pos !== row.pos || drop.where !== where) setDrop({ pos: row.pos, where });
  }
  function onDrop(e: DragEvent, row: Row) {
    e.preventDefault();
    const from = dragging.current;
    dragging.current = null;
    setDrop(null);
    if (from == null || from === row.pos) return;
    // Tính lại nửa trên / dưới theo chỗ thả (không dựa vào state của dragover — có thể chưa kịp cập nhật)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const to = e.clientY < r.top + r.height / 2 ? row.pos : row.pos + row.node.nodeSize;
    const tr = moveBlockTo(editor.state, from, to);
    if (tr) editor.view.dispatch(tr);
  }

  return (
    <div ref={ref} className="cms-ed-outline" role="tree" aria-label={t.outline}>
      <p className="cms-ed-inserter-hint">{t.outlineHint}</p>
      {rows.map((row, i) => {
        const info = blockInfo(row.node.type.name, t);
        const open = row.children.length > 0 && !collapsed.has(row.pos);
        return (
          <div key={row.pos} data-pos={row.pos} role="treeitem" aria-level={row.depth + 1} aria-selected={row.pos === data.current}
            aria-expanded={row.children.length ? open : undefined} tabIndex={row.pos === active ? 0 : -1} draggable
            className={cx("cms-ed-outline-row", row.pos === data.current && "is-current", drop?.pos === row.pos && `is-drop-${drop.where}`)}
            style={{ paddingLeft: 6 + row.depth * 14 }}
            onClick={() => { setFocusPos(row.pos); selectBlock(editor, row, false); }}
            onDoubleClick={() => selectBlock(editor, row, true)}
            onKeyDown={(e) => onKey(e, row, i)}
            onDragStart={(e) => { dragging.current = row.pos; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", info.title); }}
            onDragEnd={() => { dragging.current = null; setDrop(null); }}
            onDragOver={(e) => onDragOver(e, row)} onDragLeave={() => setDrop(null)} onDrop={(e) => onDrop(e, row)}>
            {row.children.length > 0
              ? <span className="cms-ed-outline-toggle" onClick={(e) => { e.stopPropagation(); toggle(row.pos); }} aria-hidden>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
              : <span className="cms-ed-outline-toggle" aria-hidden />}
            <info.icon size={14} aria-hidden />
            <span className="cms-ed-outline-title">{info.title}</span>
            <span className="cms-ed-outline-preview">{preview(row.node)}</span>
          </div>
        );
      })}
    </div>
  );
}
