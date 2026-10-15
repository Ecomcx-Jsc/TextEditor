import type { ContentDoc } from "./types";

/** Nội dung đã lưu → nội dung cho trình soạn. Khối "html" (vd nội dung nhập từ hệ thống cũ) được TipTap tự chuyển thành rich text. */
export function contentToEditor(content?: ContentDoc | null): { main: any; others: ContentDoc["blocks"] } {
  const blocks = content?.blocks ?? [];
  const editable = blocks.filter((b) => b.type === "richtext" || b.type === "html");
  const others = blocks.filter((b) => b.type !== "richtext" && b.type !== "html");
  if (editable.length === 1 && editable[0].type === "richtext") return { main: editable[0].data, others };
  if (editable.length === 0) return { main: "", others };
  const html = editable.map((b) => (b.type === "html" ? String(b.data?.html ?? "") : "")).join("");
  const richtext = editable.find((b) => b.type === "richtext");
  return { main: richtext && !html ? richtext.data : html, others };
}

/** Nội dung trình soạn → định dạng lưu trữ (giữ nguyên các khối không sửa được ở đây). */
export function editorToContent(json: any, others: ContentDoc["blocks"] = []): ContentDoc {
  return { version: 1, blocks: [{ id: "main", type: "richtext", data: json }, ...others] };
}
