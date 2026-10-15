# @cms/editor

Trình soạn thảo nội dung dạng khối dựa trên [TipTap](https://tiptap.dev) — tách khỏi CMS để dùng trong mọi dự án React.

- Đoạn văn, tiêu đề, danh sách, trích dẫn, khối mã, bảng, đường kẻ, YouTube, shortcode
- Ảnh responsive: srcset JPEG + WebP, **kéo góc để đổi kích thước**, chọn cỡ, căn lề (bao chữ / rộng), alt, chú thích
- Bộ sưu tập ảnh, video, âm thanh, tệp tải xuống (PDF hiển thị ngay)
- Slash menu (gõ `/`), menu nổi khi bôi đen, phím tắt (⌘B, ⌘I, ⌘K…)
- Chữ giao diện tiếng Việt / tiếng Anh (hoặc tự dịch), CSS riêng đổi màu bằng biến
- Plugin thêm khối: `registerEditorExtension`
- Lưu dạng JSON (khối) — hiển thị ra HTML bằng renderer của theme hoặc `generateHTML` của TipTap

## Dùng

```tsx
import { Editor, contentToEditor, editorToContent, enLabels, type MediaProvider } from "@cms/editor";
import "@cms/editor/style.css";

const media: MediaProvider = {
  // Mở hộp chọn media của ứng dụng bạn, trả về file đã chọn
  pick: async ({ kind, multiple }) => myMediaDialog.open({ kind, multiple }),
  get: async (id) => fetch(`/api/media/${id}`).then((r) => r.json()),
};

const { main, others } = contentToEditor(saved);
<Editor initial={main} media={media} labels={enLabels} onChange={(json) => save(editorToContent(json, others))} />
```

Không truyền `media` → chèn ảnh/video bằng URL.

## Đổi màu

```css
.cms-editor, .cms-ed-slash, .cms-ed-bubble { --cms-ed-accent: #e11d48; --cms-ed-panel: #0b0b0d; --cms-ed-fg: #fafafa; }
```

## Thêm khối (plugin)

```tsx
import { Node } from "@tiptap/core";
import { registerEditorExtension } from "@cms/editor";
import { Star } from "lucide-react";

const Callout = Node.create({ name: "callout", group: "block", content: "inline*", parseHTML: () => [{ tag: "aside" }], renderHTML: () => ["aside", 0] });

registerEditorExtension({
  name: "my-plugin",
  extensions: [Callout],
  insertItems: [{ key: "callout", title: "Hộp lưu ý", hint: "Khung nổi bật", icon: Star, keywords: "luu y callout",
    run: (editor, range) => editor.chain().focus().deleteRange(range!).insertContent({ type: "callout" }).run() }],
});
```
