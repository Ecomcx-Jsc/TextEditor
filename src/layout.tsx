import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { embedInfo } from "@cms/content";
import { ExternalLink, Link2 } from "lucide-react";
import { markContainer } from "./blockops";
import { labelsOf } from "./nodes";
import { cx } from "./util";

/**
 * Khối bố cục — khớp CORE_NODES của @cms/content 1.2: cột (columns > column), nhóm, hộp lưu ý, nút, nhúng theo đường dẫn.
 * Cột / nhóm / hộp lưu ý chứa khối khác (khối con có tay kéo + menu riêng); nút và nhúng là khối nguyên, sửa qua thanh cài đặt.
 */

/**
 * Thuộc tính của khối: trong HTML của trình soạn gộp thành một `data-attrs` (JSON) → sao chép / dán / kéo khối giữ đủ dữ liệu.
 */
function attrs(defs: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(defs).map(([k, def]) => [k, {
    default: def,
    renderHTML: () => ({}),
    parseHTML: (el: HTMLElement) => { try { const v = JSON.parse(el.getAttribute("data-attrs") ?? "{}")[k]; return v === undefined ? def : v; } catch { return def; } },
  }]));
}
const dataAttrs = (a: Record<string, unknown>) => ({ "data-attrs": JSON.stringify(Object.fromEntries(Object.entries(a).filter(([, v]) => v != null))) });

/** Màu người viết chọn: chỉ nhận dạng màu CSS (giống renderer của website). */
const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%deg/]+\)|[a-z]{3,20}|var\(--[\w-]+\))$/i;
export const safeColor = (v: unknown) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : null);
const PADDING: Record<string, string> = { none: "0", small: "12px", medium: "24px", large: "48px" };

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,4}",
  defining: true,
  isolating: true,
  addAttributes: () => attrs({ verticalAlign: null, stack: true }),
  parseHTML: () => [{ tag: "div[data-columns]" }],
  renderHTML: ({ node }) => ["div", { "data-columns": "", ...dataAttrs(node.attrs), class: cx("cms-ed-columns", node.attrs.verticalAlign && `is-${node.attrs.verticalAlign}`) }, 0],
});

export const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  defining: true,
  addAttributes: () => attrs({ width: null }),
  parseHTML: () => [{ tag: "div[data-column]" }],
  renderHTML: ({ node }) => ["div", { "data-column": "", ...dataAttrs(node.attrs), class: "cms-ed-column", style: `flex: ${Number(node.attrs.width) > 0 ? node.attrs.width : 1} 1 0` }, 0],
});

export const Group = Node.create({
  name: "group",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => attrs({ background: null, textColor: null, padding: "medium" }),
  parseHTML: () => [{ tag: "div[data-group]" }],
  renderHTML: ({ node }) => {
    const bg = safeColor(node.attrs.background), fg = safeColor(node.attrs.textColor);
    const style = [bg && `background: ${bg}`, fg && `color: ${fg}`, `padding: ${PADDING[node.attrs.padding] ?? PADDING.medium}`].filter(Boolean).join("; ");
    return ["div", { "data-group": "", ...dataAttrs(node.attrs), class: cx("cms-ed-group", bg && "has-bg"), style }, 0];
  },
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => attrs({ tone: "info", title: null }),
  parseHTML: () => [{ tag: "div[data-callout]" }],
  renderHTML: ({ node }) => ["div", mergeAttributes({ "data-callout": "", ...dataAttrs(node.attrs), "data-tone": node.attrs.tone ?? "info", class: "cms-ed-callout", role: "note" },
    node.attrs.title ? { "data-title": node.attrs.title } : {}), 0],
});

function ButtonView({ node, selected, editor }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const a = node.attrs;
  return (
    <NodeViewWrapper className={cx("cms-ed-button-wrap", a.align && `is-${a.align}`, selected && "is-selected")} data-drag-handle>
      <span className={cx("cms-ed-button", `is-${a.variant ?? "primary"}`)}>{a.text || t.buttonEmpty}</span>
      {a.href && <span className="cms-ed-button-href"><Link2 size={11} /> {a.href}</span>}
    </NodeViewWrapper>
  );
}

export const ButtonNode = Node.create({
  name: "button",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => attrs({ text: null, href: null, target: null, rel: null, variant: "primary", align: null }),
  parseHTML: () => [{ tag: "div[data-button]" }],
  renderHTML: ({ node }) => ["div", { "data-button": "", ...dataAttrs(node.attrs) }],
  addNodeView: () => ReactNodeViewRenderer(ButtonView),
});

function EmbedView({ node, selected, editor }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const info = embedInfo(node.attrs.url);
  return (
    <NodeViewWrapper className={cx("cms-ed-block", "cms-ed-embed", selected && "is-selected")} data-drag-handle>
      <div className="cms-ed-block-label">{info ? info.title : t.embed}</div>
      {info ? (
        <div className="cms-ed-embed-frame" style={info.aspect ? { aspectRatio: String(info.aspect), maxWidth: info.maxWidth } : { height: info.height, maxWidth: info.maxWidth }}>
          <iframe src={info.src} title={node.attrs.caption || info.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" tabIndex={-1} />
          {/* Lớp phủ: bấm chọn khối thay vì chạy khung nhúng trong lúc soạn */}
          <span className="cms-ed-embed-cover" />
        </div>
      ) : (
        <div className="cms-ed-embed-unknown"><ExternalLink size={14} /> <span>{node.attrs.url || "—"}</span> <small>{t.embedUnsupported}</small></div>
      )}
      {node.attrs.caption && <div className="cms-ed-embed-caption">{node.attrs.caption}</div>}
    </NodeViewWrapper>
  );
}

export const EmbedNode = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => attrs({ url: null, caption: null }),
  parseHTML: () => [{ tag: "div[data-embed]" }],
  renderHTML: ({ node }) => ["div", { "data-embed": "", ...dataAttrs(node.attrs) }],
  addNodeView: () => ReactNodeViewRenderer(EmbedView),
});

// Khối con trong cột / nhóm / hộp lưu ý có tay kéo + menu riêng
for (const name of ["column", "group", "callout"]) markContainer(name);

export const layoutExtensions = () => [Columns, Column, Group, Callout, ButtonNode, EmbedNode];

/** Cột rỗng (một đoạn văn trống). */
export const emptyColumn = (width: number | null = null) => ({ type: "column", attrs: { width }, content: [{ type: "paragraph" }] });

/** Đổi số cột: thêm cột trống vào cuối, hoặc bỏ cột cuối (nội dung của nó dồn sang cột liền trước). Độ rộng về chia đều. */
export function setColumnCount(editor: Editor, pos: number, count: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "columns" || count < 2 || count > 4 || count === node.childCount) return false;
  const { schema } = editor.state;
  const cols = Array.from({ length: node.childCount }, (_, i) => node.child(i).type.create({ width: null }, node.child(i).content));
  while (cols.length < count) cols.push(schema.nodeFromJSON(emptyColumn()));
  while (cols.length > count) {
    const last = cols.pop()!, prev = cols.pop()!;
    const empty = last.childCount === 1 && last.firstChild!.isTextblock && last.firstChild!.content.size === 0;
    cols.push(empty ? prev : prev.type.create(prev.attrs, prev.content.append(last.content)));
  }
  editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, node.type.create(node.attrs, cols)));
  return true;
}

/** Đặt độ rộng các cột theo tỉ lệ (vd [33, 67]). */
export function setColumnWidths(editor: Editor, pos: number, widths: number[]) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "columns" || widths.length !== node.childCount) return false;
  const tr = editor.state.tr;
  let p = pos + 1;
  node.forEach((col, _off, i) => { tr.setNodeMarkup(p, undefined, { ...col.attrs, width: widths[i] }); p += col.nodeSize; });
  editor.view.dispatch(tr);
  return true;
}

/** Bố cục có sẵn theo số cột. */
export const COLUMN_PRESETS: Record<number, number[][]> = {
  2: [[50, 50], [33, 67], [67, 33], [25, 75], [75, 25]],
  3: [[33, 33, 33], [25, 50, 25], [50, 25, 25], [25, 25, 50]],
  4: [[25, 25, 25, 25]],
};
