import { normalizeContent } from "@cms/content";
import { registeredBlocks } from "./blocks";
import type { ContentDoc } from "./types";

/** Nội dung đã lưu → nội dung cho trình soạn. Khối "html" (vd nội dung nhập từ hệ thống cũ) được TipTap tự chuyển thành rich text. */
export function contentToEditor(content?: ContentDoc | null): { main: any; others: ContentDoc["blocks"] } {
  // Chuẩn hoá theo định dạng của CMS + nâng phiên bản khối của plugin (defineBlock) lưu bằng bản cũ
  const blocks = content ? normalizeContent(content, { blocks: registeredBlocks() }).doc.blocks : [];
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
  // Chuẩn hoá theo định dạng của CMS (bỏ thuộc tính null, ép kiểu) — máy chủ cũng chuẩn hoá lại khi lưu
  return normalizeContent({ version: 1, blocks: [{ id: "main", type: "richtext", data: json }, ...others] }, { blocks: registeredBlocks() }).doc as ContentDoc;
}
