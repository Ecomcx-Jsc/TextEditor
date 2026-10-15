import type { MediaItem, MediaSize } from "./types";

/** Cỡ cùng tỉ lệ ≤ cỡ được chọn → srcset (trình duyệt tự chọn file vừa đủ). */
function candidates(m: MediaItem, size: string): MediaSize[] {
  const full: MediaSize = { url: m.url, width: m.width ?? 0, height: m.height ?? 0, webpUrl: m.webpUrl };
  const sizes = m.sizes ?? {};
  const target = size === "full" ? full : sizes[size] ?? full;
  const r = target.height ? target.width / target.height : 0;
  const all = [...Object.values(sizes), full];
  const list = all.filter((s) => s.width && s.height && s.width <= target.width && Math.abs(s.width / s.height - r) < 0.02);
  if (!list.includes(target)) list.push(target);
  return list.sort((a, b) => a.width - b.width).filter((s, i, arr) => i === 0 || s.width !== arr[i - 1].width);
}

/** Thuộc tính node ảnh khi chèn từ thư viện: src, srcset JPEG + WebP, kích thước (chống nhảy layout). */
export function imageAttrs(m: MediaItem, size = "large") {
  const list = candidates(m, size);
  const main = list[list.length - 1];
  return {
    src: main.url, mediaId: m.id, size, alt: m.alt || "", caption: m.caption || null,
    width: main.width || null, height: main.height || null,
    srcset: list.length > 1 ? list.map((s) => `${s.url} ${s.width}w`).join(", ") : null,
    webpSrcset: list.every((s) => s.webpUrl) ? list.map((s) => `${s.webpUrl} ${s.width}w`).join(", ") : null,
  };
}

/** Ảnh trong gallery: cỡ medium_large (đủ nét dạng lưới) + liên kết ảnh gốc. */
export function galleryImage(m: MediaItem) {
  const a = imageAttrs(m, m.sizes?.medium_large ? "medium_large" : "large");
  return { mediaId: m.id, src: a.src, srcset: a.srcset, webpSrcset: a.webpSrcset, width: a.width, height: a.height, alt: m.alt || "", caption: m.caption || "", full: m.url };
}
