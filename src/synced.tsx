import { Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Pencil, Repeat2, Unlink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { labelsOf } from "./nodes";
import { patternNodes } from "./patterns";
import { cx } from "./util";

/**
 * Mẫu đồng bộ: khối `syncedPattern { ref }` chỉ là tham chiếu — nội dung lấy từ mẫu gốc (ứng dụng cung cấp qua PatternHost),
 * sửa mẫu gốc thì mọi chỗ dùng đổi theo. "Tách ra" thay tham chiếu bằng bản chép để sửa riêng.
 */
export interface PatternHost {
  /** Nội dung + tên của mẫu (`content`: cây khối hoặc `{ version, blocks }`). null = mẫu đã bị xoá / không xem được. */
  resolve(ref: number): Promise<{ title: string; content: unknown } | null>;
  /** Lưu các khối thành mẫu (ứng dụng hỏi tên, nhóm, đồng bộ). null = huỷ. */
  create?(nodes: JSONContent[]): Promise<{ ref: number; synced: boolean } | null>;
  /** Mở mẫu gốc để sửa (vd tab mới). */
  edit?(ref: number): void;
}

export const patternHostOf = (editor: Editor): PatternHost | undefined => (editor.storage as any).cmsEditorContext?.patterns;

// Mỗi mẫu tải một lần cho mọi trình soạn; quay lại tab (có thể vừa sửa mẫu gốc) thì tải lại
type Resolved = { title: string; content: unknown } | null;
const cache = new Map<number, Promise<Resolved>>();
const listeners = new Set<() => void>();
export function refreshSyncedPatterns(ref?: number) {
  if (ref == null) cache.clear(); else cache.delete(ref);
  listeners.forEach((l) => l());
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshSyncedPatterns(); });

function useResolved(editor: Editor, ref: number | null) {
  const [state, setState] = useState<{ ref: number | null; value: Resolved | undefined }>({ ref, value: undefined });
  const [version, setVersion] = useState(0);
  useEffect(() => { const l = () => setVersion((v) => v + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  useEffect(() => {
    const host = patternHostOf(editor);
    if (!ref || !host) { setState({ ref, value: null }); return; }
    let alive = true;
    if (!cache.has(ref)) cache.set(ref, host.resolve(ref).catch(() => null));
    cache.get(ref)!.then((value) => { if (alive) setState({ ref, value }); });
    return () => { alive = false; };
  }, [editor, ref, version]);
  return state.ref === ref ? state.value : undefined;
}

function SyncedView({ node, editor, selected, getPos }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const ref = typeof node.attrs.ref === "number" ? node.attrs.ref : null;
  const pattern = useResolved(editor, ref);
  const nodes = useMemo(() => (pattern ? patternNodes({ name: "", title: "", category: "", content: pattern.content }) : []), [pattern]);
  const html = useMemo(() => {
    if (!nodes.length) return "";
    try {
      const doc = editor.schema.nodeFromJSON({ type: "doc", content: nodes });
      const div = document.createElement("div");
      div.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content));
      return div.innerHTML;
    } catch { return ""; }
  }, [editor, nodes]);
  const host = patternHostOf(editor);

  function detach() {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null || !nodes.length) return;
    editor.chain().focus().insertContentAt({ from: pos, to: pos + node.nodeSize }, nodes).run();
  }

  return (
    <NodeViewWrapper className={cx("cms-ed-block", "cms-ed-synced", selected && "is-selected")} data-drag-handle data-synced-pattern={ref ?? ""}>
      <div className="cms-ed-synced-bar" contentEditable={false}>
        <Repeat2 size={13} />
        <span className="cms-ed-synced-title">{pattern === undefined ? t.syncedLoading : pattern ? `${t.syncedPattern}: ${pattern.title}` : t.syncedMissing}</span>
        {ref && host?.edit && pattern && <button type="button" onClick={() => host.edit!(ref)}><Pencil size={12} />{t.syncedEdit}</button>}
        {pattern && <button type="button" onClick={detach}><Unlink size={12} />{t.syncedDetach}</button>}
      </div>
      {html && <div className="cms-ed-synced-preview ecx-content" contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} />}
    </NodeViewWrapper>
  );
}

export const SyncedPattern = Node.create({
  name: "syncedPattern",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({ ref: { default: null, parseHTML: (el: HTMLElement) => Number(el.getAttribute("data-synced-pattern")) || null, renderHTML: () => ({}) } }),
  parseHTML: () => [{ tag: "div[data-synced-pattern]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-synced-pattern": String(node.attrs.ref ?? "") })],
  addNodeView: () => ReactNodeViewRenderer(SyncedView),
});

/** Khối cùng cấp đang được chọn (bôi đen qua nhiều khối) chứa `pos`, không thì chỉ khối ở `pos`. */
export function selectedSiblings(editor: Editor, block: { pos: number; node: { nodeSize: number }; depth: number }): { from: number; to: number; nodes: JSONContent[] } {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  let start = block.pos, end = block.pos + block.node.nodeSize;
  if (!empty) {
    const $b = state.doc.resolve(block.pos);
    const parent = $b.parent, base = $b.start();
    let offset = 0;
    parent.forEach((child) => {
      const a = base + offset, b = a + child.nodeSize;
      if (b > from && a < to) { start = Math.min(start, a); end = Math.max(end, b); }
      offset += child.nodeSize;
    });
  }
  const slice = state.doc.slice(start, end);
  const nodes: JSONContent[] = [];
  slice.content.forEach((n) => nodes.push(n.toJSON()));
  return { from: start, to: end, nodes };
}

/** Lưu khối đang chọn thành mẫu; mẫu đồng bộ → thay các khối bằng tham chiếu. */
export async function createPatternFrom(editor: Editor, block: { pos: number; node: { nodeSize: number }; depth: number }): Promise<boolean> {
  const host = patternHostOf(editor);
  if (!host?.create) return false;
  const range = selectedSiblings(editor, block);
  if (!range.nodes.length) return false;
  const res = await host.create(range.nodes);
  if (!res) return false;
  if (res.synced) editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, { type: "syncedPattern", attrs: { ref: res.ref } }).run();
  return true;
}
