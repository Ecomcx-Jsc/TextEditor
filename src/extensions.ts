import { getSchema, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { AudioNode, CmsImage, EditorContext, FileNode, Gallery, VideoNode } from "./nodes";
import { UnknownBlock, UnknownInline, UnknownMark } from "./unknown";
import { layoutExtensions } from "./layout";

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
    TableKit.configure({ table: { resizable: false } }),
    TaskList, TaskItem.configure({ nested: true }),
    Subscript, Superscript, Highlight.configure({ multicolor: true }), TextStyle, Color,
    ...layoutExtensions(),
    UnknownBlock, UnknownInline, UnknownMark,
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
