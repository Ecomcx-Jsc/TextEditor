import type { Editor as TiptapEditor } from "@tiptap/core";

/** Chèn khối: dòng trống đang có con trỏ → thay luôn dòng đó (không để lại đoạn trống thừa); không thì chèn tại con trỏ. */
export function insertBlock(e: TiptapEditor, node: Record<string, unknown>) {
  const { $from, empty } = e.state.selection;
  if (empty && $from.depth > 0 && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0)
    return e.chain().focus().insertContentAt({ from: $from.before(), to: $from.after() }, node).run();
  return e.chain().focus().insertContent(node).run();
}
