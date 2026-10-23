import { getSchema, type AnyExtension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Table, TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { AudioNode, CmsImage, EditorContext, FileNode, Gallery, VideoNode } from "./nodes";
import { UnknownBlock, UnknownInline, UnknownMark } from "./unknown";
import { layoutExtensions } from "./layout";
import { BlockStyleAttr } from "./styleattr";

/**
 * Mọi khối + định dạng lõi mà trình soạn hiểu — khớp với định dạng nội dung của CMS (@cms/content CORE_NODES/CORE_MARKS):
 * mọi thứ website vẽ được thì trình soạn mở và lưu lại được. Dùng chung cho Editor và test hợp đồng.
 */
export function coreExtensions(): AnyExtension[] {
  return [
    // Link: không tự gắn rel="nofollow"/tab mới cho mọi liên kết (mặc định của TipTap) — website/plugin SEO quyết định theo tên miền
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { target: null, rel: null } } }),
    CmsImage, Gallery, VideoNode, AudioNode, FileNode, EditorContext,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Youtube.configure({ nocookie: true }),
    TableKit.configure({ table: false }),
    // Bảng: chân bảng (hàng cuối → <tfoot> trên website) + cố định độ rộng cột
    Table.extend({
      addAttributes() {
        const flag = (name: string) => ({ default: false, parseHTML: (el: HTMLElement) => el.hasAttribute(`data-${name}`), renderHTML: (a: Record<string, unknown>) => (a[name] ? { [`data-${name}`]: "" } : {}) });
        return { ...this.parent?.(), footer: flag("footer"), fixed: flag("fixed") };
      },
      // Bảng dùng node view riêng (không nhận thuộc tính HTML) → gắn data-footer / data-fixed lên khung bảng bằng decoration
      addProseMirrorPlugins() {
        return [...(this.parent?.() ?? []), new Plugin({
          key: new PluginKey("cmsTableFlags"),
          props: {
            decorations: (state) => {
              const decos: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                if (node.type.name !== "table") return;
                const attrs: Record<string, string> = {};
                if (node.attrs.footer) attrs["data-footer"] = "";
                if (node.attrs.fixed) attrs["data-fixed"] = "";
                if (Object.keys(attrs).length) decos.push(Decoration.node(pos, pos + node.nodeSize, attrs));
                return false;
              });
              return DecorationSet.create(state.doc, decos);
            },
          },
        })];
      },
    }).configure({ resizable: false }),
    TaskList, TaskItem.configure({ nested: true }),
    Subscript, Superscript, Highlight.configure({ multicolor: true }), TextStyle, Color,
    ...layoutExtensions(),
    UnknownBlock, UnknownInline, UnknownMark,
    BlockStyleAttr,
  ];
}

const known = new Map<string, { nodes: Set<string>; marks: Set<string> }>();

/** Tên khối / định dạng mà trình soạn (lõi + gói mở rộng đang đăng ký) hiểu được. */
export function knownTypes(extra: AnyExtension[] = []): { nodes: Set<string>; marks: Set<string> } {
  const key = extra.map((e) => e.name).sort().join(",");
  let hit = known.get(key);
  if (!hit) {
    const schema = getSchema([...coreExtensions(), ...extra]);
    hit = { nodes: new Set(Object.keys(schema.nodes)), marks: new Set(Object.keys(schema.marks)) };
    known.set(key, hit);
  }
  return hit;
}
