import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import { defineBlock, normalizeContent } from "@ecomcx/nexus-content";
import { coreExtensions, knownTypes } from "../src/extensions";
import { unwrapUnknown, wrapUnknown } from "../src/unknown";
import { contentToEditor, editorToContent } from "../src/content";
import { blockNode, registerBlock, registeredBlocks, unregisterBlock } from "../src/blocks";
import { registeredExtensions } from "../src/registry";

// Hợp đồng phía trình soạn: mở mỗi bài mẫu của @ecomcx/nexus-content trong trình soạn rồi lưu lại → nội dung giữ nguyên
// (sai khác duy nhất được chấp nhận: trình soạn ghi thêm thuộc tính bằng đúng giá trị mặc định — cùng ý nghĩa).
const fixturesDir = path.join(path.dirname(createRequire(import.meta.url).resolve("@ecomcx/nexus-content/package.json")), "fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(fixturesDir, f), "utf8")));

import { registerBasicBlocks } from "../src/basic";
registerBasicBlocks();

function roundTrip(content: unknown) {
  const extra = registeredExtensions().flatMap((p) => p.extensions ?? []);
  const schema = getSchema([...coreExtensions(), ...extra]);
  const { main, others } = contentToEditor(content as any);
  const doc = schema.nodeFromJSON(wrapUnknown(main, knownTypes(extra)));
  doc.check(); // nội dung hợp lệ với schema của trình soạn (không chỉ "đọc được")
  return { saved: editorToContent(unwrapUnknown(doc.toJSON()), others), schema };
}

/** So ý nghĩa, không so cách ghi: bỏ thuộc tính bằng giá trị mặc định của schema trình soạn (vd ảnh size "large"), bỏ qua thứ tự định dạng. */
function stripDefaults(node: any, schema: ReturnType<typeof getSchema>): any {
  if (Array.isArray(node)) return node.map((n) => stripDefaults(n, schema));
  if (!node || typeof node !== "object") return node;
  const out: any = {};
  for (const [k, v] of Object.entries(node)) out[k] = k === "attrs" ? v : stripDefaults(v, schema);
  // Thứ tự định dạng trên cùng đoạn chữ không mang ý nghĩa (ProseMirror xếp theo thứ hạng trong schema)
  if (Array.isArray(out.marks)) out.marks = [...out.marks].sort((a: any, b: any) => a.type.localeCompare(b.type));
  const type = schema.nodes[node.type] ?? schema.marks[node.type];
  if (type && node.attrs) {
    const attrs: any = {};
    for (const [k, v] of Object.entries(node.attrs)) if (JSON.stringify(v) !== JSON.stringify((type.spec.attrs as any)?.[k]?.default ?? null)) attrs[k] = v;
    if (Object.keys(attrs).length) out.attrs = attrs; else delete out.attrs;
  }
  return out;
}

for (const f of fixtures) {
  // Khối "html" (nội dung nhập từ hệ thống cũ) được trình soạn chuyển thành rich text — không phải vòng khép kín
  if (JSON.stringify(f.expected).includes('"type":"html"')) continue;
  // Bài rỗng: trình soạn luôn có một tài liệu (rỗng) — cùng ý nghĩa
  if (!f.expected.blocks.length) continue;
  test(`trình soạn mở rồi lưu lại: ${f.name}`, () => {
    const { saved, schema } = roundTrip(f.input);
    assert.deepEqual(stripDefaults(saved, schema), stripDefaults(normalizeContent(f.expected).doc, schema));
  });
}

test("khối của plugin chưa bật: hiện 'không xác định', lưu lại không mất dữ liệu", () => {
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "other/emoji", attrs: { code: "x" } }, { type: "text", text: "b", marks: [{ type: "other/glow", attrs: { c: 1 } }] }] }, { type: "other/hero", attrs: { title: "T", n: 2 }, content: [{ type: "paragraph" }] }] };
  const { saved } = roundTrip(content);
  assert.deepEqual(saved, normalizeContent(content).doc);
});

const callout = defineBlock({ name: "demo/callout", title: "Hộp lưu ý", content: "blocks", attributes: { tone: { type: "string", enum: ["info", "warning"], default: "info" } } });
const badge = defineBlock({ name: "demo/badge", title: "Nhãn", version: 2, attributes: { tone: { type: "string" } }, migrate: { 1: ({ color, ...r }) => ({ ...r, tone: color }) } });

test("khối defineBlock: node sinh tự động, lưu đúng thuộc tính, nâng phiên bản khi mở bài cũ", () => {
  registerBlock(callout); registerBlock(badge);
  try {
    assert.ok(["demo/callout", "demo/badge"].every((n) => registeredBlocks().some((b) => b.name === n)));
    const content = { type: "doc", content: [
      { type: "demo/callout", attrs: { tone: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Chú ý" }] }] },
      { type: "demo/badge", attrs: { color: "red" } }] };
    const { saved } = roundTrip(content);
    assert.deepEqual(saved.blocks[0].data.content, [
      { type: "demo/callout", attrs: { tone: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Chú ý" }] }] },
      { type: "demo/badge", attrs: { tone: "red", _v: 2 } }]);
  } finally { unregisterBlock(callout.name); unregisterBlock(badge.name); }
});

test("blockNode: content none → atom, blocks → chứa khối", () => {
  assert.equal(blockNode(badge).config.atom, true);
  assert.equal(blockNode(callout).config.content, "block+");
});

test("registerBlockPanel: thuộc tính plugin thêm vào khối lõi được trình soạn giữ khi mở + lưu", async () => {
  const { registerBlockPanel, unregisterBlockPanel } = await import("../src/panels");
  const content = { type: "doc", content: [{ type: "image", attrs: { src: "/a.png", lazy: false } }] };
  // Chưa khai báo: TipTap bỏ thuộc tính lạ
  assert.equal(roundTrip(content).saved.blocks[0].data.content[0].attrs.lazy, undefined);
  registerBlockPanel({ id: "demo/lazy", title: "Lazy", blocks: ["image"], attributes: { lazy: { default: true } }, component: () => null });
  try {
    assert.equal(roundTrip(content).saved.blocks[0].data.content[0].attrs.lazy, false);
  } finally { unregisterBlockPanel("demo/lazy"); }
});

test("khối động: đăng ký xong thì fixture dynamic-blocks mở + lưu lại bằng node thật (không qua khối lạ)", async () => {
  const { registerDynamicBlocks, DYNAMIC_BLOCKS } = await import("../src/dynamic");
  registerDynamicBlocks("vi");
  try {
    const f = fixtures.find((x) => x.name === "dynamic-blocks")!;
    const { saved, schema } = roundTrip(f.input);
    for (const name of DYNAMIC_BLOCKS) assert.ok(schema.nodes[name], `thiếu node ${name}`);
    assert.ok(!JSON.stringify(saved).includes("unknown"), "không được bọc thành khối lạ");
    assert.deepEqual(stripDefaults(saved, schema), stripDefaults(normalizeContent(f.expected).doc, schema));
  } finally { for (const name of DYNAMIC_BLOCKS) unregisterBlock(name); }
});

test("mẫu lõi: mọi mẫu chuẩn hoá được và hợp lệ với schema trình soạn (chèn không lỗi)", async () => {
  const { registerCorePatterns, registeredPatterns, patternNodes } = await import("../src/patterns");
  registerCorePatterns("vi");
  const extra = registeredExtensions().flatMap((p) => p.extensions ?? []);
  const schema = getSchema([...coreExtensions(), ...extra]);
  const list = registeredPatterns();
  assert.ok(list.length >= 8);
  for (const p of list) {
    const nodes = patternNodes(p);
    assert.ok(nodes.length > 0, p.name);
    schema.nodeFromJSON({ type: "doc", content: nodes }).check();
  }
});
