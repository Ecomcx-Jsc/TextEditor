export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
/** Bỏ dấu tiếng Việt để tìm lệnh: "anh" khớp "Ảnh". */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
