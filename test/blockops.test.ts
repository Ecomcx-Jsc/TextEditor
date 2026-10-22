import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { coreExtensions } from "../src/extensions";
import { blockFromPos, currentBlock, deleteBlock, duplicateBlock, insertParagraphAfter, moveBlock, parentBlock } from "../src/blockops";

const schema = getSchema(coreExtensions());
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: any[]) => schema.nodeFromJSON({ type: "doc", content });
const texts = (s: EditorState) => s.doc.content.content.map((n) => n.textContent || n.type.name);
/** Trạng thái với con trỏ trong khối thứ `i`. */
function at(d: ReturnType<typeof doc>, i: number) {
  let pos = 0;
  for (let k = 0; k < i; k++) pos += d.child(k).nodeSize;
  return EditorState.create({ schema, doc: d, selection: TextSelection.create(d, pos + 1) });
}

test("khối hiện tại: đoạn văn trong danh sách → cả danh sách", () => {
  const d = doc(p("a"), { type: "bulletList", content: [{ type: "listItem", content: [p("x")] }] });
  assert.equal(currentBlock(EditorState.create({ schema, doc: d, selection: TextSelection.create(d, 6) }))?.node.type.name, "bulletList");
});

test("lên / xuống: đổi chỗ với khối kề, con trỏ đi theo; đầu/cuối thì không làm gì", () => {
  const s = at(doc(p("a"), p("b"), p("c")), 1);
  const b = currentBlock(s)!;
  const up = s.apply(moveBlock(s, b, -1)!);
  assert.deepEqual(texts(up), ["b", "a", "c"]);
  assert.equal(currentBlock(up)?.node.textContent, "b");
  const down = s.apply(moveBlock(s, b, 1)!);
  assert.deepEqual(texts(down), ["a", "c", "b"]);
  assert.equal(currentBlock(down)?.node.textContent, "b");
  // Con trỏ giữ đúng chỗ trong khối (sau chữ "b")
  assert.equal(down.selection.$from.parentOffset, 0);
  const end = EditorState.create({ schema, doc: s.doc, selection: TextSelection.create(s.doc, 5) });
  const moved = end.apply(moveBlock(end, currentBlock(end)!, 1)!);
  assert.equal(moved.selection.$from.parent.textContent, "b");
  assert.equal(moved.selection.$from.parentOffset, 1);
  assert.equal(moveBlock(at(s.doc, 0), currentBlock(at(s.doc, 0))!, -1), null);
  assert.equal(moveBlock(at(s.doc, 2), currentBlock(at(s.doc, 2))!, 1), null);
});

test("nhân bản và xoá", () => {
  const s = at(doc(p("a"), p("b")), 0);
  assert.deepEqual(texts(s.apply(duplicateBlock(s, currentBlock(s)!))), ["a", "a", "b"]);
  assert.deepEqual(texts(s.apply(deleteBlock(s, currentBlock(s)!))), ["b"]);
  // Khối cuối cùng → còn lại đoạn văn trống (tài liệu không được rỗng)
  const one = at(doc(p("x")), 0);
  const after = one.apply(deleteBlock(one, currentBlock(one)!));
  assert.equal(after.doc.childCount, 1);
  assert.equal(after.doc.firstChild?.textContent, "");
});

test("khối nguyên khối (đường kẻ) chọn được, di chuyển được", () => {
  const d = doc(p("a"), { type: "horizontalRule" }, p("b"));
  const s = EditorState.create({ schema, doc: d, selection: NodeSelection.create(d, 3) });
  const b = currentBlock(s)!;
  assert.equal(b.node.type.name, "horizontalRule");
  const moved = s.apply(moveBlock(s, b, 1)!);
  assert.deepEqual(texts(moved), ["a", "b", "horizontalRule"]);
  assert.ok(moved.selection instanceof NodeSelection);
});

test("thêm đoạn văn bên dưới, con trỏ nằm trong đó", () => {
  const s = at(doc(p("a"), p("b")), 0);
  const next = s.apply(insertParagraphAfter(s, currentBlock(s)!));
  assert.deepEqual(texts(next), ["a", "paragraph", "b"]);
  assert.equal(next.selection.$from.parent.type.name, "paragraph");
  assert.equal(next.selection.from, 4);
});

test("blockFromPos ngoài phạm vi → null; khối cấp cao nhất không có khối cha", () => {
  const d = doc(p("a"));
  assert.equal(blockFromPos(d, 999), null);
  assert.equal(parentBlock(d, blockFromPos(d, 0)!), null);
});
