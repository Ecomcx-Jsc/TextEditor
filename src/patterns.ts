import type { Editor as TiptapEditor } from "@tiptap/core";
import { normalizeContent } from "@ecomcx/nexus-content";

/**
 * Mẫu (pattern): đoạn nội dung dựng sẵn (giới thiệu, tính năng, bảng giá, kêu gọi hành động…) — chèn = chép khối vào bài,
 * sau đó sửa tự do (không liên kết với mẫu). Nguồn: lõi (registerCorePatterns), theme (patterns/*.json), plugin (registerPattern).
 */
export interface Pattern {
  /** Tên duy nhất: lõi "core/…", theme "theme/…", plugin "slug-plugin/…". */
  name: string;
  title: string;
  description?: string;
  /** Nhóm trong trình chèn: hero, features, cta, pricing, testimonials, faq, team, contact, text, gallery, footer, header… */
  category: string;
  keywords?: string;
  /** Nội dung: cây khối (`{ type: "doc", content }`), mảng khối, hoặc `{ version, blocks }` của @ecomcx/nexus-content. */
  content: unknown;
  /** Mẫu do người dùng tạo: id của mẫu. */
  ref?: number;
  /** Mẫu đồng bộ: chèn thành tham chiếu (`syncedPattern { ref }`) thay vì chép khối. */
  synced?: boolean;
}

const patterns = new Map<string, Pattern>();
const listeners = new Set<() => void>();
let snapshot: Pattern[] = [];
const changed = () => { snapshot = [...patterns.values()]; listeners.forEach((l) => l()); };

export function registerPattern(p: Pattern) { patterns.set(p.name, p); changed(); }
export function unregisterPattern(name: string) { if (patterns.delete(name)) changed(); }
export const registeredPatterns = (): Pattern[] => snapshot;
export function onPatternsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Khối của mẫu (đã chuẩn hoá theo @ecomcx/nexus-content). */
export function patternNodes(p: Pattern): Array<Record<string, unknown>> {
  const raw = Array.isArray(p.content) ? { type: "doc", content: p.content } : p.content;
  const { doc } = normalizeContent(raw);
  const main = doc.blocks.find((b) => b.type === "richtext");
  return ((main?.data as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []);
}

/** Chèn mẫu dưới khối đang chọn (dòng trống đang có con trỏ → thay dòng đó). */
export function insertPattern(editor: TiptapEditor, p: Pattern) {
  const nodes = p.synced && p.ref ? [{ type: "syncedPattern", attrs: { ref: p.ref } }] : patternNodes(p);
  if (!nodes.length) return false;
  const { $from, empty } = editor.state.selection;
  if (empty && $from.depth > 0 && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0)
    return editor.chain().focus().insertContentAt({ from: $from.before(), to: $from.after() }, nodes).run();
  const after = $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
  return editor.chain().focus().insertContentAt(after, nodes).run();
}

// ---------------------------------------------------------------------------
// Mẫu có sẵn của lõi (dựng bằng bộ khối cơ bản — mọi theme hiển thị được)
// ---------------------------------------------------------------------------
type L = Record<string, string>;
const vi: L = {
  hero: "Ảnh bìa giới thiệu", heroD: "Tiêu đề lớn trên ảnh nền + 2 nút", heroTitle: "Tiêu đề thật ấn tượng", heroText: "Một câu ngắn nói rõ bạn mang lại điều gì cho khách hàng.",
  start: "Bắt đầu ngay", learn: "Tìm hiểu thêm",
  features: "Ba tính năng", featuresD: "Tiêu đề + 3 cột tính năng", featuresTitle: "Vì sao chọn chúng tôi", f1: "Nhanh", f2: "An toàn", f3: "Dễ dùng", fText: "Mô tả ngắn về lợi ích này.",
  cta: "Kêu gọi hành động", ctaD: "Khung nổi bật với nút", ctaTitle: "Sẵn sàng bắt đầu?", ctaText: "Đăng ký hôm nay để nhận ưu đãi.", ctaBtn: "Liên hệ ngay",
  pricing: "Bảng giá 3 gói", pricingD: "3 gói dạng thẻ, có danh sách quyền lợi", basic: "Cơ bản", pro: "Chuyên nghiệp", biz: "Doanh nghiệp", perMonth: "/tháng", choose: "Chọn gói", item: "Quyền lợi",
  faq: "Câu hỏi thường gặp", faqD: "Tiêu đề + các câu hỏi thu gọn", q: "Câu hỏi", a: "Câu trả lời ngắn gọn.",
  testimonial: "Cảm nhận khách hàng", testimonialD: "Trích dẫn nổi bật kèm tên", quote: "Dịch vụ tuyệt vời, tôi sẽ giới thiệu cho bạn bè.", who: "Nguyễn Văn A, Giám đốc",
  intro: "Ảnh + giới thiệu", introD: "Ảnh một bên, chữ và nút bên kia", introTitle: "Về chúng tôi", introText: "Giới thiệu ngắn về công ty, sứ mệnh và giá trị.",
  contact: "Liên hệ", contactD: "Thông tin liên hệ + mạng xã hội", contactTitle: "Liên hệ với chúng tôi", contactText: "Địa chỉ · Số điện thoại · Email",
};
const en: L = {
  hero: "Hero cover", heroD: "Big heading over a background image + 2 buttons", heroTitle: "A headline that stands out", heroText: "One short sentence about what you offer your customers.",
  start: "Get started", learn: "Learn more",
  features: "Three features", featuresD: "Heading + 3 feature columns", featuresTitle: "Why choose us", f1: "Fast", f2: "Secure", f3: "Easy", fText: "A short description of this benefit.",
  cta: "Call to action", ctaD: "Highlighted box with a button", ctaTitle: "Ready to start?", ctaText: "Sign up today for a special offer.", ctaBtn: "Contact us",
  pricing: "Pricing — 3 plans", pricingD: "3 plan cards with a feature list", basic: "Basic", pro: "Pro", biz: "Business", perMonth: "/month", choose: "Choose plan", item: "Feature",
  faq: "FAQ", faqD: "Heading + collapsible questions", q: "Question", a: "A short answer.",
  testimonial: "Testimonial", testimonialD: "Pullquote with a name", quote: "Great service, I will recommend it to my friends.", who: "Jane Doe, CEO",
  intro: "Media + intro", introD: "Image on one side, text and button on the other", introTitle: "About us", introText: "A short introduction to the company, its mission and values.",
  contact: "Contact", contactD: "Contact details + social links", contactTitle: "Get in touch", contactText: "Address · Phone · Email",
};

const text = (s: string, marks?: Array<{ type: string }>) => (marks ? { type: "text", text: s, marks } : { type: "text", text: s });
const p = (s: string, attrs?: Record<string, unknown>) => ({ type: "paragraph", ...(attrs ? { attrs } : {}), content: [text(s)] });
const h = (level: number, s: string, attrs: Record<string, unknown> = {}) => ({ type: "heading", attrs: { level, ...attrs }, content: [text(s)] });
const btn = (s: string, variant = "primary") => ({ type: "button", attrs: { text: s, href: "#", variant } });
const buttons = (align: string, ...list: object[]) => ({ type: "buttons", attrs: { align }, content: list });

function corePatterns(t: L): Pattern[] {
  const plan = (name: string, price: string, variant: string) => ({ type: "group", attrs: { blockStyle: "card" }, content: [
    h(3, name), h(2, price, { style: { fontSize: { base: "2xl" } } }),
    { type: "bulletList", content: [1, 2, 3].map((n) => ({ type: "listItem", content: [p(`${t.item} ${n}`)] })) },
    buttons("left", btn(t.choose, variant)),
  ] });
  const col = (title: string) => ({ type: "column", content: [h(3, title), p(t.fText)] });
  return [
    { name: "core/hero", category: "hero", title: t.hero, description: t.heroD, keywords: "hero banner cover anh bia", content: [
      { type: "cover", attrs: { overlay: "#000000", opacity: 55, minHeight: "70vh", contentAlign: "center" }, content: [
        h(1, t.heroTitle, { textAlign: "center" }), p(t.heroText, { textAlign: "center" }), buttons("center", btn(t.start), btn(t.learn, "outline"))] }] },
    { name: "core/features-3", category: "features", title: t.features, description: t.featuresD, keywords: "features tinh nang cot", content: [
      h(2, t.featuresTitle, { textAlign: "center" }), { type: "spacer", attrs: { height: "md" } },
      { type: "columns", content: [col(t.f1), col(t.f2), col(t.f3)] }] },
    { name: "core/cta", category: "cta", title: t.cta, description: t.ctaD, keywords: "cta call to action keu goi", content: [
      { type: "group", attrs: { blockStyle: "card", style: { textAlign: { base: "center" }, padding: { base: "xl", mobile: "lg" } } }, content: [
        h(2, t.ctaTitle, { textAlign: "center" }), p(t.ctaText, { textAlign: "center" }), buttons("center", btn(t.ctaBtn))] }] },
    { name: "core/pricing-3", category: "pricing", title: t.pricing, description: t.pricingD, keywords: "pricing bang gia goi", content: [
      { type: "columns", content: [
        { type: "column", content: [plan(t.basic, "0đ", "outline")] },
        { type: "column", content: [plan(t.pro, `199k${t.perMonth}`, "primary")] },
        { type: "column", content: [plan(t.biz, `499k${t.perMonth}`, "outline")] }] }] },
    { name: "core/faq", category: "faq", title: t.faq, description: t.faqD, keywords: "faq hoi dap cau hoi", content: [
      h(2, t.faq), ...[1, 2, 3].map((n) => ({ type: "details", attrs: { summary: `${t.q} ${n}?` }, content: [p(t.a)] }))] },
    { name: "core/testimonial", category: "testimonials", title: t.testimonial, description: t.testimonialD, keywords: "testimonial danh gia cam nhan", content: [
      { type: "pullquote", attrs: { citation: t.who }, content: [text(t.quote)] }] },
    { name: "core/intro", category: "text", title: t.intro, description: t.introD, keywords: "about gioi thieu media", content: [
      { type: "mediaText", attrs: { position: "left", width: 50, verticalAlign: "center" }, content: [h(2, t.introTitle), p(t.introText), buttons("left", btn(t.learn, "outline"))] }] },
    { name: "core/contact", category: "contact", title: t.contact, description: t.contactD, keywords: "contact lien he", content: [
      h(2, t.contactTitle), p(t.contactText),
      { type: "socialLinks", attrs: { links: [{ service: "facebook", url: "https://facebook.com" }, { service: "zalo", url: "https://zalo.me" }, { service: "email", url: "mailto:hello@example.com" }] } }] },
  ];
}

let coreLocale: string | null = null;
/** Mẫu có sẵn của lõi (gọi lại với ngôn ngữ khác để đổi chữ trong mẫu). */
export function registerCorePatterns(locale: "vi" | "en" = "vi") {
  if (coreLocale === locale) return;
  coreLocale = locale;
  for (const pattern of corePatterns(locale === "en" ? en : vi)) patterns.set(pattern.name, pattern);
  changed();
}

export const PATTERN_CATEGORIES = ["hero", "features", "cta", "pricing", "testimonials", "faq", "team", "contact", "text", "gallery", "header", "footer"];
