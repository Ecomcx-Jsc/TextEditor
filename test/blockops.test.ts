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

test("moveBlockTo: kéo khối tới vị trí bất kỳ (cây khối), kể cả vào / ra khỏi nhóm; chỗ không hợp lệ → null", async () => {
  const { moveBlockTo, blockTree } = await import("../src/blockops");
  const d = doc(p("a"), { type: "group", content: [p("g1"), p("g2")] }, p("b"));
  const s = EditorState.create({ schema, doc: d });
  const tree = blockTree(s.doc);
  assert.deepEqual(tree.map((x) => x.node.type.name), ["paragraph", "group", "paragraph"]);
  assert.deepEqual(tree[1].children.map((x) => x.node.textContent), ["g1", "g2"]);
  // "b" vào đầu nhóm
  const into = s.apply(moveBlockTo(s, tree[2].pos, tree[1].children[0].pos)!);
  assert.deepEqual(blockTree(into.doc)[1].children.map((x) => x.node.textContent), ["b", "g1", "g2"]);
  // "g2" ra khỏi nhóm, lên đầu bài
  const out = s.apply(moveBlockTo(s, tree[1].children[1].pos, 0)!);
  assert.deepEqual(blockTree(out.doc).map((x) => x.node.textContent), ["g2", "a", "g1", "b"]);
  // Thả vào trong chính nó → null
  assert.equal(moveBlockTo(s, tree[1].pos, tree[1].children[1].pos), null);
  // Lấy khối cuối của nhóm ra → nhóm còn đoạn trống, vẫn hợp lệ
  const one = EditorState.create({ schema, doc: doc(p("a"), { type: "group", content: [p("only")] }) });
  const t1 = blockTree(one.doc);
  const moved = one.apply(moveBlockTo(one, t1[1].children[0].pos, 0)!);
  moved.doc.check();
  assert.equal(moved.doc.child(0).textContent, "only");
});

test("moveBlockTo: cột chỉ đổi chỗ trong bộ cột của nó", async () => {
  const { moveBlockTo, blockTree } = await import("../src/blockops");
  const col = (t: string) => ({ type: "column", content: [p(t)] });
  const s = EditorState.create({ schema, doc: doc(p("a"), { type: "columns", content: [col("c1"), col("c2")] }) });
  const tree = blockTree(s.doc);
  const cols = tree[1].children;
  const swapped = s.apply(moveBlockTo(s, cols[1].pos, cols[0].pos)!);
  assert.deepEqual(blockTree(swapped.doc)[1].children.map((x) => x.node.textContent), ["c2", "c1"]);
  assert.equal(moveBlockTo(s, cols[0].pos, 0), null);
});
