import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

/**
 * Thao tác trên khối (tay kéo, menu khối, phím tắt) — hàm thuần trên trạng thái ProseMirror, test được không cần trình duyệt.
 * "Khối" = nút nằm trực tiếp trong một vùng chứa khối: doc, cột, nhóm, hộp lưu ý, khối plugin có content "blocks".
 * Mục danh sách, ô bảng… không phải khối riêng: thao tác áp lên cả danh sách / cả bảng.
 */
const containers = new Set(["doc"]);

/** Đánh dấu một loại nút là vùng chứa khối (khối con bên trong có tay kéo + menu riêng). */
export function markContainer(name: string) { containers.add(name); }
export const isContainer = (node: PMNode) => containers.has(node.type.name);

export interface BlockRef { pos: number; node: PMNode; depth: number }

/** Khối chứa nút bắt đầu ở `pos` (chính nó nếu nằm trực tiếp trong vùng chứa, không thì tổ tiên gần nhất). */
export function blockFromPos(doc: PMNode, pos: number): BlockRef | null {
  if (pos < 0 || pos >= doc.content.size) return null;
  const $p = doc.resolve(pos);
  const node = doc.nodeAt(pos);
  if (node && isContainer($p.parent)) return { pos, node, depth: $p.depth + 1 };
  for (let d = $p.depth; d >= 1; d--) if (isContainer($p.node(d - 1))) return { pos: $p.before(d), node: $p.node(d), depth: d };
  return null;
}

/** Khối đang có con trỏ / đang được chọn. */
export function currentBlock(state: EditorState): BlockRef | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection) return blockFromPos(state.doc, sel.from);
  const $from = sel.$from;
  if ($from.depth === 0) return null;
  return blockFromPos(state.doc, $from.before($from.depth));
}

/** Khối cha (để chọn cả cột / nhóm chứa khối hiện tại). */
export function parentBlock(doc: PMNode, block: BlockRef): BlockRef | null {
  const $p = doc.resolve(block.pos);
  for (let d = $p.depth; d >= 1; d--) {
    const before = $p.before(d);
    const found = blockFromPos(doc, before);
    if (found && found.pos !== block.pos) return found;
  }
  return null;
}

/** Sau khi chuyển khối: giữ con trỏ / vùng chọn ở đúng chỗ cũ bên trong khối (nếu nó nằm trong khối), không thì vào đầu khối. */
function keepSelection(state: EditorState, tr: Transaction, block: BlockRef, newPos: number) {
  const sel = state.selection, end = block.pos + block.node.nodeSize;
  if (sel instanceof NodeSelection && sel.from === block.pos) return tr.setSelection(NodeSelection.create(tr.doc, newPos));
  if (sel.from >= block.pos && sel.to <= end) {
    const shift = newPos - block.pos;
    try { return tr.setSelection(TextSelection.create(tr.doc, sel.anchor + shift, sel.head + shift)); } catch { /* vị trí không còn hợp lệ */ }
  }
  return selectInside(tr, newPos);
}

function selectInside(tr: Transaction, pos: number) {
  const node = tr.doc.nodeAt(pos);
  if (!node) return tr;
  // Khối có chữ → đặt con trỏ vào đầu khối; khối nguyên khối (ảnh, bộ sưu tập…) → chọn cả khối
  if (node.isAtom || !node.inlineContent && !node.firstChild) return tr.setSelection(NodeSelection.create(tr.doc, pos));
  const sel = Selection.findFrom(tr.doc.resolve(pos + 1), 1, true);
  return sel ? tr.setSelection(sel) : tr.setSelection(NodeSelection.create(tr.doc, pos));
}

/** Đổi chỗ khối với khối liền trên (-1) / liền dưới (1) trong cùng vùng chứa. null = không di chuyển được. */
export function moveBlock(state: EditorState, block: BlockRef, dir: -1 | 1): Transaction | null {
  const $p = state.doc.resolve(block.pos);
  const parent = $p.parent, index = $p.index();
  const target = index + dir;
  if (target < 0 || target >= parent.childCount) return null;
  const other = parent.child(target);
  const tr = state.tr;
  if (dir === -1) {
    const start = block.pos - other.nodeSize;
    tr.replaceWith(start, block.pos + block.node.nodeSize, Fragment.from([block.node, other]));
    return keepSelection(state, tr, block, start).scrollIntoView();
  }
  tr.replaceWith(block.pos, block.pos + block.node.nodeSize + other.nodeSize, Fragment.from([other, block.node]));
  return keepSelection(state, tr, block, block.pos + other.nodeSize).scrollIntoView();
}

/** Chèn bản sao ngay dưới khối. */
export function duplicateBlock(state: EditorState, block: BlockRef): Transaction {
  const after = block.pos + block.node.nodeSize;
  return selectInside(state.tr.insert(after, block.node), after).scrollIntoView();
}

/** Xoá khối. Vùng chứa chỉ còn khối này → thay bằng đoạn văn trống (vùng chứa không được rỗng). */
export function deleteBlock(state: EditorState, block: BlockRef): Transaction {
  const $p = state.doc.resolve(block.pos);
  const tr = state.tr;
  const end = block.pos + block.node.nodeSize;
  if ($p.parent.childCount === 1) {
    const p = state.schema.nodes.paragraph.create();
    tr.replaceWith(block.pos, end, p);
    return tr.setSelection(TextSelection.create(tr.doc, block.pos + 1));
  }
  tr.delete(block.pos, end);
  const sel = Selection.findFrom(tr.doc.resolve(Math.min(block.pos, tr.doc.content.size)), -1, true) ?? Selection.findFrom(tr.doc.resolve(Math.min(block.pos, tr.doc.content.size)), 1, true);
  if (sel) tr.setSelection(sel);
  return tr.scrollIntoView();
}

/** Chèn đoạn văn trống ngay dưới khối, đặt con trỏ vào đó. */
export function insertParagraphAfter(state: EditorState, block: BlockRef): Transaction {
  const after = block.pos + block.node.nodeSize;
  const tr = state.tr.insert(after, state.schema.nodes.paragraph.create());
  return tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
}

/**
 * Chuyển khối ở `from` tới vị trí `to` (vị trí giữa hai khối, theo tài liệu hiện tại) — dùng cho kéo thả trong cây khối.
 * null khi không hợp lệ: thả vào chính nó / bên trong nó, hoặc chỗ đến không nhận loại khối này (vd cột chỉ nằm trong bộ cột).
 */
export function moveBlockTo(state: EditorState, from: number, to: number): Transaction | null {
  const node = state.doc.nodeAt(from);
  if (!node) return null;
  if (to > from && to < from + node.nodeSize) return null;
  if (to === from || to === from + node.nodeSize) return null;
  // Cột chỉ đổi chỗ trong chính bộ cột của nó (bộ cột cần 2–4 cột)
  if (node.type.name === "column" && state.doc.resolve(from).start() !== state.doc.resolve(to).start()) return null;
  const $from = state.doc.resolve(from), $to = state.doc.resolve(to);
  const tr = state.tr;
  let at: number;
  if ($from.start() === $to.start()) {
    // Cùng vùng chứa: sắp lại thứ tự cả vùng một lần (không qua trạng thái thiếu khối, vd bộ cột chỉ còn 1 cột)
    const kids: PMNode[] = [];
    $from.parent.forEach((c) => kids.push(c));
    const fromIdx = $from.index();
    let toIdx = $to.index();
    kids.splice(fromIdx, 1);
    if (toIdx > fromIdx) toIdx--;
    kids.splice(toIdx, 0, node);
    tr.replaceWith($from.start(), $from.end(), Fragment.from(kids));
    at = $from.start() + kids.slice(0, toIdx).reduce((n, k) => n + k.nodeSize, 0);
  } else {
    if (!$to.parent.canReplaceWith($to.index(), $to.index(), node.type)) return null;
    // Chèn trước rồi xoá bản gốc; vùng chứa mất khối cuối cùng được ProseMirror bù đoạn trống
    tr.insert(to, node);
    const start = tr.mapping.map(from);
    tr.delete(start, start + node.nodeSize);
    // Vị trí khối vừa chèn (bắt đầu ở `to` sau bước chèn) đi qua bước xoá
    at = tr.mapping.slice(1).map(to, 1);
  }
  return selectInside(tr, at).scrollIntoView();
}

export interface BlockTreeItem { pos: number; node: PMNode; depth: number; children: BlockTreeItem[] }

/** Cây khối của tài liệu: khối trong vùng chứa (doc, cột trong bộ cột, nhóm…) — như "List View" của Gutenberg. */
export function blockTree(doc: PMNode): BlockTreeItem[] {
  const walk = (parent: PMNode, start: number, depth: number): BlockTreeItem[] => {
    const out: BlockTreeItem[] = [];
    parent.forEach((child, offset) => {
      const pos = start + offset;
      // Bộ cột: từng cột là một mục (cột không phải vùng chứa trực tiếp của doc nhưng chứa khối)
      const nested = isContainer(child) || child.type.name === "columns" ? walk(child, pos + 1, depth + 1) : [];
      out.push({ pos, node: child, depth, children: nested });
    });
    return out;
  };
  return walk(doc, 0, 0);
}

/** Đổi thuộc tính của khối ở `pos`; khối đang được chọn cả khối thì vẫn giữ chọn (setNodeMarkup làm mất NodeSelection). */
export function setBlockAttrs(state: EditorState, pos: number, attrs: Record<string, unknown>): Transaction | null {
  const node = state.doc.nodeAt(pos);
  if (!node) return null;
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  if (state.selection instanceof NodeSelection && state.selection.from === pos) tr.setSelection(NodeSelection.create(tr.doc, pos));
  return tr;
}
