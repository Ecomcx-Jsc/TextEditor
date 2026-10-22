import { Mark, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { labelsOf } from "./nodes";
import { cx } from "./util";

/**
 * Khối / định dạng mà trình soạn không hiểu (plugin đã tắt hoặc chưa cài): giữ NGUYÊN dữ liệu gốc trong thuộc tính `raw`,
 * hiển thị khung "không xác định", lưu lại trả về đúng như cũ (unwrapUnknown) — bật lại plugin là hiện như trước.
 */
export const UNKNOWN_BLOCK = "cmsUnknownBlock", UNKNOWN_INLINE = "cmsUnknownInline", UNKNOWN_MARK = "cmsUnknownMark";

const raw = { raw: { default: null, renderHTML: () => ({}), parseHTML: () => null } };

function View({ node, selected, editor }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const type = (node.attrs.raw as { type?: string } | null)?.type ?? "?";
  const inline = node.type.name === UNKNOWN_INLINE;
  return (
    <NodeViewWrapper as={inline ? "span" : "div"} className={cx(inline ? "cms-ed-unknown-inline" : "cms-ed-block cms-ed-unknown", selected && "is-selected")} data-drag-handle>
      {inline ? <code>{type}</code> : <><div className="cms-ed-block-label">{t.unknownBlock}</div><code>{type}</code> <span>{t.unknownBlockHint}</span></>}
    </NodeViewWrapper>
  );
}

export const UnknownBlock = Node.create({
  name: UNKNOWN_BLOCK, group: "block", atom: true, draggable: true, selectable: true,
  addAttributes: () => raw,
  parseHTML: () => [{ tag: "div[data-cms-unknown]" }],
  renderHTML: () => ["div", { "data-cms-unknown": "" }],
  addNodeView: () => ReactNodeViewRenderer(View),
});

export const UnknownInline = Node.create({
  name: UNKNOWN_INLINE, group: "inline", inline: true, atom: true, selectable: true,
  addAttributes: () => raw,
  parseHTML: () => [{ tag: "span[data-cms-unknown]" }],
  renderHTML: () => ["span", { "data-cms-unknown": "" }],
  addNodeView: () => ReactNodeViewRenderer(View),
});

/** Định dạng chữ lạ: giữ nguyên, có thể chồng nhiều cái (excludes ""). */
export const UnknownMark = Mark.create({
  name: UNKNOWN_MARK, excludes: "",
  addAttributes: () => raw,
  parseHTML: () => [{ tag: "span[data-cms-unknown-mark]" }],
  renderHTML: () => ["span", { "data-cms-unknown-mark": "", class: "cms-ed-unknown-mark" }, 0],
});

type J = { type: string; attrs?: Record<string, any>; content?: J[]; marks?: Array<{ type: string; attrs?: Record<string, any> }>; text?: string };
const TEXTBLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

/** Nội dung → trình soạn: thay khối / định dạng lạ bằng bản bọc giữ nguyên dữ liệu gốc. */
export function wrapUnknown(doc: J, known: { nodes: Set<string>; marks: Set<string> }): J {
  const walk = (n: J, inlineContext: boolean): J => {
    if (!known.nodes.has(n.type)) return { type: inlineContext ? UNKNOWN_INLINE : UNKNOWN_BLOCK, attrs: { raw: n } };
    const out: J = { ...n };
    if (n.marks) out.marks = n.marks.map((m) => (known.marks.has(m.type) ? m : { type: UNKNOWN_MARK, attrs: { raw: m } }));
    if (n.content) out.content = n.content.map((c) => walk(c, TEXTBLOCKS.has(n.type) || (inlineContext && n.type !== "doc")));
    return out;
  };
  return walk(doc, false);
}

/** Trình soạn → nội dung: trả khối / định dạng lạ về đúng dữ liệu gốc. */
export function unwrapUnknown(doc: J): J {
  const walk = (n: J): J => {
    if ((n.type === UNKNOWN_BLOCK || n.type === UNKNOWN_INLINE) && n.attrs?.raw) return n.attrs.raw as J;
    const out: J = { ...n };
    if (n.marks) out.marks = n.marks.map((m) => (m.type === UNKNOWN_MARK && m.attrs?.raw ? m.attrs.raw : m));
    if (n.content) out.content = n.content.map(walk);
    return out;
  };
  return walk(doc);
}
