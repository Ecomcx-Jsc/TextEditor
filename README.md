# @cms/editor

Trình soạn thảo nội dung dạng khối dựa trên [TipTap](https://tiptap.dev) — tách khỏi CMS để dùng trong mọi dự án React.

- Đoạn văn, tiêu đề, danh sách, trích dẫn, khối mã, bảng, đường kẻ, YouTube, shortcode
- Ảnh responsive: srcset JPEG + WebP, **kéo góc để đổi kích thước**, chọn cỡ, căn lề (bao chữ / rộng), alt, chú thích
- Bộ sưu tập ảnh, video, âm thanh, tệp tải xuống (PDF hiển thị ngay)
- Khối bố cục (`@cms/content` ≥ 1.2): cột (2–4, bố cục 50/50, 33/67…, căn dọc, xếp dọc trên điện thoại), nhóm (nền, màu chữ, khoảng đệm), hộp lưu ý (4 kiểu + tiêu đề), nút (chữ, liên kết, kiểu, căn lề), nhúng theo đường dẫn (YouTube, Vimeo, Spotify, SoundCloud, TikTok, X, Instagram, CodePen, Figma, Google Maps… — `embedInfo`); thanh cài đặt khối hiện phía trên khối đang soạn
- Dán từ Word / Google Docs sạch (`cleanPastedHtml`: định dạng bằng style → đậm/nghiêng/gạch chân; bỏ font, màu, thẻ Office; danh sách Word thành danh sách thật); dán một đường dẫn hỗ trợ nhúng vào dòng trống → khối nhúng
- Đếm từ, ký tự, thời gian đọc dưới vùng soạn
- Bố cục trình dựng cho ứng dụng nhúng (1.5): `BlockInspector` (tab "Khối": đường dẫn khối cha, cài đặt theo loại khối, thao tác), `BlockInserter` (tìm, bấm để chèn, kéo vào bài), `BlockTree` (cây khối: chọn, bàn phím, kéo đổi chỗ kể cả vào/ra vùng chứa) — truyền đối tượng nhận từ `onReady` của `Editor`
- `registerBlockPanel({ id, title, blocks, attributes, component })`: plugin thêm mục vào tab "Khối" cho khối bất kỳ (kể cả khối lõi), khai báo thêm thuộc tính để trình soạn lưu được
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
import "@cms/editor/style.css";   // gồm cả giao diện nền của nội dung (@cms/content/style.css)

const media: MediaProvider = {
  // Mở hộp chọn media của ứng dụng bạn, trả về file đã chọn
  pick: async ({ kind, multiple }) => myMediaDialog.open({ kind, multiple }),
  get: async (id) => fetch(`/api/media/${id}`).then((r) => r.json()),
};

const { main, others } = contentToEditor(saved);
<Editor initial={main} media={media} labels={enLabels} onChange={(json) => save(editorToContent(json, others))} />
```

Không truyền `media` → chèn ảnh/video bằng URL.

## Mẫu (1.12)

Trình chèn có tab **Mẫu**: đoạn nội dung dựng sẵn theo nhóm (ảnh bìa, tính năng, kêu gọi hành động, bảng giá, cảm nhận, hỏi đáp, liên hệ…) có xem trước thu nhỏ, tìm không dấu, bấm để chèn (chép khối — sửa tự do). Nguồn: `registerCorePatterns(locale)` (mẫu lõi, dựng bằng bộ khối cơ bản), `registerPattern({ name, title, category, description?, keywords?, content })` (theme / plugin / ứng dụng). `insertPattern(editor, pattern)`, `patternNodes(pattern)`.

## Biến thể, neo, class, preset (1.11)

Mọi khối có thuộc tính `blockStyle` (class `ecx-is-…`), `anchor` (id), `className`. `BlockInspector` nhận `presets` (preset của theme — bảng màu, cỡ chữ, khoảng cách, phông trong tab Kiểu dáng) và `blockStyles` (biến thể của theme theo loại khối; cộng với biến thể có sẵn `CORE_BLOCK_STYLES`); tab Cài đặt có mục Nâng cao (neo HTML, class CSS riêng). `<Editor presets>` áp biến `--ecx-*` vào vùng soạn — cùng giá trị với website.

## Bộ khối cơ bản (1.10)

Có sẵn ở mọi trình soạn (`registerBasicBlocks("en")` để đổi nhãn): mục lục, ảnh bìa (ảnh nền + lớp phủ + nội dung), ảnh + chữ, nhóm nút, khoảng trống, trích dẫn nổi bật, chi tiết (thu gọn), HTML tuỳ chỉnh (trình soạn chỉ hiện mã nguồn, không chạy), mạng xã hội (sửa link ngay trong khối), văn bản định dạng sẵn (giữ khoảng trắng, Enter xuống dòng trong khối). Chèn bảng hỏi số cột × số hàng. Form cài đặt khối có điều khiển `media` (chọn ảnh từ nguồn media của Editor). Slash menu nhận nhiều từ ("/dinh dang").

## Tab Kiểu dáng (1.9)

`<BlockInspector editor={…} device={…} onDeviceChange={…} />` có hai tab **Cài đặt / Kiểu dáng**. Tab Kiểu dáng ghi `attrs.style` (@cms/content): Kiểu chữ (phông preset, cỡ S/M/L/XL/2XL hoặc tuỳ chỉnh, độ đậm + nghiêng, giãn dòng, giãn cách ký tự, trang trí, viết hoa, căn chữ), Màu (chữ, nền — preset của theme hoặc màu tuỳ chỉnh), Kích thước & khoảng cách (padding/margin một giá trị hoặc 4 cạnh, khoảng cách khối con, rộng, rộng tối đa, cao tối thiểu), Viền & bo góc, Hiển thị (ẩn theo khổ). Chọn khổ màn hình (máy tính / máy tính bảng / điện thoại) → giá trị theo khổ sửa cho khổ đó, khổ chưa đặt hiện giá trị kế thừa. Menu ⋮ mỗi mục bật/tắt điều khiển (nhớ trong trình duyệt) + đặt lại. Giá trị sai báo đỏ, không lưu. Trình soạn hiện kiểu dáng ngay (cùng CSS với website); mọi khối có thuộc tính `style` (`BlockStyleAttr`).

## Thanh công cụ khối (1.8)

Bấm vào khối → thanh nổi phía trên khối: loại khối (đoạn văn, tiêu đề, danh sách, trích dẫn, khối mã — bấm để đổi loại), kéo, lên/xuống, nút riêng theo khối (căn chữ, thụt danh sách, đậm/nghiêng/liên kết, ảnh: cỡ/căn lề/alt/chú thích/thay ảnh, bảng: thêm/bớt hàng cột/hàng tiêu đề/xoá), menu ⋮ (thêm khối phía trên/dưới, nhân bản, chọn khối cha, xoá). Ẩn khi đang gõ, hiện lại khi rê chuột hoặc bấm. `role="toolbar"`, class `cms-ed-blockbar`.

## Khối động (1.7)

```tsx
import { registerDynamicBlocks } from "@cms/editor";
registerDynamicBlocks("vi");                // một lần; node của khối động (@cms/content DYNAMIC_NODES) có mặt ở mọi trình soạn
<Editor dynamicBlocks … />                  // chỉ trình soạn này cho chèn (nhóm "Giao diện" trong trình chèn và slash menu)
```

Mỗi khối hiện thành khung có tên + dòng tóm tắt (vị trí menu, phần dùng chung, nguồn danh sách bài); cài đặt sinh từ thuộc tính. `query` chèn vào có sẵn `postTemplate` (tiêu đề + sapo) và `pagination`. `registerBlock` có thêm `initialContent` cho khối chứa khối khác.

## Đổi màu

```css
.cms-editor, .cms-ed-slash, .cms-ed-bubble { --cms-ed-accent: #e11d48; --cms-ed-panel: #0b0b0d; --cms-ed-fg: #fafafa; }
```

Vùng soạn có class `ecx-content` → bảng, danh sách, trích dẫn, khối bố cục dùng chung giao diện nền với website (`@cms/content/style.css`, `@layer ecx-content`). Ứng dụng có CSS reset trong layer (Tailwind) khai báo `@layer ecx-content;` sau các layer của mình để nền thắng reset.

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
