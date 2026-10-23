import type { InsertItem } from "./types";
import { norm } from "./util";

/**
 * Lọc + xếp hạng lệnh: tên bắt đầu bằng chữ gõ > một từ trong tên bắt đầu bằng chữ gõ > từ khoá bắt đầu bằng chữ gõ
 * > gõ nhiều từ, mỗi từ khớp đầu một từ của tên / từ khoá ("/dinh dang" ra "Văn bản định dạng sẵn").
 * (Không khớp giữa từ: "/anh" ra "Ảnh", không ra "D-anh sách".)
 */
export function rankItems(list: InsertItem[], query: string): InsertItem[] {
  const q = norm(query.trim());
  if (!q) return list;
  const score = (i: InsertItem) => {
    const title = norm(i.title);
    if (title.startsWith(q)) return 3;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    const words = [...title.split(/\s+/), ...norm(i.keywords).split(/\s+/)];
    if (words.some((w) => w.startsWith(q)) || i.key.startsWith(q)) return 1;
    const parts = q.split(/\s+/);
    return parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p))) ? 0.5 : 0;
  };
  return list.map((i) => [i, score(i)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
}
