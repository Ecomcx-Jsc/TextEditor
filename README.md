# @cms/editor

Trình soạn thảo nội dung dạng khối dựa trên [TipTap](https://tiptap.dev) — tách khỏi CMS để dùng trong mọi dự án React.

- Đoạn văn, tiêu đề, danh sách, trích dẫn, khối mã, bảng, đường kẻ, YouTube, shortcode
- Ảnh responsive: srcset JPEG + WebP, **kéo góc để đổi kích thước**, chọn cỡ, căn lề (bao chữ / rộng), alt, chú thích
- Bộ sưu tập ảnh, video, âm thanh, tệp tải xuống (PDF hiển thị ngay)
- Khối bố cục (`@cms/content` ≥ 1.2): cột (2–4, bố cục 50/50, 33/67…, căn dọc, xếp dọc trên điện thoại), nhóm (nền, màu chữ, khoảng đệm), hộp lưu ý (4 kiểu + tiêu đề), nút (chữ, liên kết, kiểu, căn lề), nhúng theo đường dẫn (YouTube, Vimeo, Spotify, SoundCloud, TikTok, X, Instagram, CodePen, Figma, Google Maps… — `embedInfo`); thanh cài đặt khối hiện phía trên khối đang soạn
- Dán từ Word / Google Docs sạch (`cleanPastedHtml`: định dạng bằng style → đậm/nghiêng/gạch chân; bỏ font, màu, thẻ Office; danh sách Word thành danh sách thật); dán một đường dẫn hỗ trợ nhúng vào dòng trống → khối nhúng
- Đếm từ, ký tự, thời gian đọc dưới vùng soạn
- Slash menu (gõ `/`), menu nổi khi bôi đen, phím tắt (⌘B, ⌘I, ⌘K…)
- Thao tác khối: tay kéo bên trái khối (kéo để di chuyển, bấm mở menu lên / xuống / nhân bản / xoá / chọn khối cha), nút "+" thêm khối bên dưới; phím tắt ⌘⇧↑ ⌘⇧↓ ⌘⇧D ⌘⇧⌫, Alt+F10 mở menu khối bằng bàn phím
- Hộp nhập đặt cạnh chỗ soạn (liên kết, alt, chú thích, YouTube, shortcode) thay `window.prompt` — gói mở rộng dùng chung qua `askOf(editor)(…)`
- Trợ năng: vùng soạn `role="textbox"` + `aria-multiline` + `aria-label` (prop `ariaLabel`), menu theo WAI-ARIA
- Chữ giao diện tiếng Việt / tiếng Anh (hoặc tự dịch), CSS riêng đổi màu bằng biến
- Plugin thêm khối: `registerEditorExtension`
- Lưu dạng JSON (khối) — hiển thị ra HTML bằng renderer của theme hoặc `generateHTML` của TipTap

## TipTap đi kèm (vendored)

Trình soạn mang sẵn đúng bản TipTap + ProseMirror đã kiểm thử (`node_modules` của các gói đó được commit, khai báo `bundleDependencies`): cài `@cms/editor` từ GitHub không tải TipTap từ npm — TipTap có ngừng phát triển hay đổi gói thì mọi CMS vẫn cài và build được. Không phần nào khác import TipTap: plugin dùng `defineBlock` / `registerBlock`; lớp cấp thấp (`Node`, `Mark`, `Extension`, `mergeAttributes`) xuất lại từ `@cms/editor`.

Nâng TipTap: đổi phiên bản trong `package.json` → `npm install` → `node scripts/vendor.mjs` → `npm test` (hợp đồng nội dung phải qua) → commit cả `node_modules/` đã vendor.

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
