import type { AnyExtension, Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";

/** Kích thước ảnh đã tạo sẵn (thumbnail, medium, large…), kèm bản WebP nếu có. */
export interface MediaSize { url: string; width: number; height: number; webpUrl?: string | null }

/** File media mà ứng dụng cung cấp cho trình soạn (ảnh, video, âm thanh, tài liệu). */
export interface MediaItem {
  id: number | string;
  url: string;
  mimeType: string;
  fileName: string;
  title?: string;
  alt?: string;
  caption?: string;
  width?: number | null;
  height?: number | null;
  size?: number;
  sizes?: Record<string, MediaSize>;
  webpUrl?: string | null;
}

export type MediaKind = "image" | "gallery" | "video" | "audio" | "file";

/**
 * Nguồn media do ứng dụng nhúng cung cấp (thư viện media của CMS, S3, Cloudinary…).
 * Không truyền → trình soạn cho dán URL ảnh/video.
 */
export interface MediaProvider {
  /** Mở hộp chọn của ứng dụng; trả về file được chọn (rỗng = huỷ). */
  pick(options: { kind: MediaKind; multiple: boolean }): Promise<MediaItem[]>;
  /** Lấy lại thông tin một file (để đổi cỡ ảnh đã chèn). */
  get?(id: MediaItem["id"]): Promise<MediaItem | null>;
}

/** Một lệnh chèn trong slash menu ("/"). */
export interface InsertItem {
  key: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  /** Từ khoá tìm kiếm (không dấu, cách nhau bởi khoảng trắng). */
  keywords: string;
  run(editor: Editor, range?: Range): void;
}

/** Gói mở rộng (plugin của CMS hoặc ứng dụng): thêm node/mark TipTap và lệnh chèn. */
export interface EditorExtensionPack {
  name: string;
  extensions?: AnyExtension[];
  insertItems?: InsertItem[];
}

/** Nội dung lưu trữ: danh sách khối (sẵn sàng cho page builder). */
export interface ContentDoc { version: number; blocks: Array<{ id?: string; type: string; data: any }> }
