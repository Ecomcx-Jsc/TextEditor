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
