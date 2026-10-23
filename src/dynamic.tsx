import { DYNAMIC_NODES, defineBlock, type BlockAttrSpec, type BlockDefinition } from "@cms/content";
import {
  AlignLeft, Calendar, Copyright, FileText, Globe, Heading1, Image, Languages, LayoutTemplate, List, ListX, Menu, MessageSquare, MoreHorizontal,
  PanelTop, Repeat, Search, Tags, Text, Type, User, type LucideIcon,
} from "lucide-react";
import type { BlockEditProps } from "./blocks";
import { registerBlock } from "./blocks";

/** Khối động (lấy dữ liệu lúc hiển thị) — dùng trong Trình dựng và trang dựng bằng khối. */
export const DYNAMIC_BLOCKS = new Set<string>(DYNAMIC_NODES);

type Dict = Record<string, string>;
const vi: Dict = {
  siteTitle: "Tên website", siteLogo: "Logo", siteTagline: "Khẩu hiệu", navigation: "Menu", search: "Tìm kiếm", languageSwitcher: "Chọn ngôn ngữ",
  copyright: "Bản quyền", postTitle: "Tiêu đề bài/trang", postContent: "Nội dung bài/trang", postExcerpt: "Sapo", featuredImage: "Ảnh đại diện",
  postDate: "Ngày đăng", postAuthor: "Tác giả", postTerms: "Chuyên mục / thẻ", comments: "Bình luận", query: "Danh sách bài",
  postTemplate: "Khuôn mỗi bài", pagination: "Phân trang", queryEmpty: "Khi không có bài", templatePart: "Phần dùng chung",
  level: "Cấp tiêu đề (0 = chữ thường)", link: "Có liên kết", textAlign: "Căn chữ", width: "Rộng (px)", location: "Vị trí menu",
  orientation: "Hướng", horizontal: "Ngang", vertical: "Dọc", mobile: "Nút menu trên điện thoại", placeholder: "Chữ gợi ý", buttonText: "Chữ trên nút",
  text: "Tên chủ sở hữu (trống = tên website)", moreText: "Chữ “đọc tiếp”", size: "Cỡ ảnh", aspect: "Tỉ lệ khung", avatar: "Hiện ảnh đại diện",
  taxonomy: "Phân loại (category, post_tag…)", separator: "Dấu ngăn cách", inherit: "Dùng danh sách của trang đang xem", postType: "Loại bài",
  perPage: "Số bài", category: "Chuyên mục (slug)", tag: "Thẻ (slug)", orderBy: "Sắp xếp theo", date: "Ngày", title: "Tiêu đề", menu_order: "Thứ tự",
  order: "Thứ tự", desc: "Mới trước", asc: "Cũ trước", layout: "Bố cục", list: "Danh sách", grid: "Lưới", columns: "Số cột",
  slug: "Phần (slug, vd header)", tagName: "Thẻ HTML", left: "Trái", center: "Giữa", right: "Phải", justify: "Đều",
  inheritSummary: "danh sách của trang", partSummary: "phần “{v}”", menuSummary: "vị trí “{v}”",
};
const en: Dict = {
  siteTitle: "Site title", siteLogo: "Logo", siteTagline: "Tagline", navigation: "Navigation", search: "Search", languageSwitcher: "Language switcher",
  copyright: "Copyright", postTitle: "Post/page title", postContent: "Post/page content", postExcerpt: "Excerpt", featuredImage: "Featured image",
  postDate: "Date", postAuthor: "Author", postTerms: "Categories / tags", comments: "Comments", query: "Post list",
  postTemplate: "Post template", pagination: "Pagination", queryEmpty: "No results", templatePart: "Template part",
  level: "Heading level (0 = text)", link: "Link", textAlign: "Text align", width: "Width (px)", location: "Menu location",
  orientation: "Orientation", horizontal: "Horizontal", vertical: "Vertical", mobile: "Menu button on mobile", placeholder: "Placeholder", buttonText: "Button text",
  text: "Owner (empty = site title)", moreText: "“Read more” text", size: "Image size", aspect: "Aspect ratio", avatar: "Show avatar",
  taxonomy: "Taxonomy (category, post_tag…)", separator: "Separator", inherit: "Use the list of the current page", postType: "Post type",
  perPage: "Posts", category: "Category (slug)", tag: "Tag (slug)", orderBy: "Order by", date: "Date", title: "Title", menu_order: "Menu order",
  order: "Order", desc: "Newest first", asc: "Oldest first", layout: "Layout", list: "List", grid: "Grid", columns: "Columns",
  slug: "Part (slug, e.g. header)", tagName: "HTML tag", left: "Left", center: "Center", right: "Right", justify: "Justify",
  inheritSummary: "list of the page", partSummary: "part “{v}”", menuSummary: "location “{v}”",
};

const s = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "string", label, ...extra });
const i = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "integer", label, ...extra });
const b = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "boolean", label, ...extra });
const align = s("textAlign", { enum: ["left", "center", "right", "justify"], enumLabels: ["left", "center", "right", "justify"], default: "left" });

const SPECS: Array<[string, LucideIcon, "none" | "blocks", Record<string, BlockAttrSpec>]> = [
  ["siteTitle", Type, "none", { level: i("level", { min: 0, max: 6, default: 0 }), link: b("link", { default: true }), textAlign: align }],
  ["siteLogo", Image, "none", { width: i("width", { min: 16, max: 600, default: 120 }), link: b("link", { default: true }) }],
  ["siteTagline", Text, "none", { textAlign: align }],
  ["navigation", Menu, "none", { location: s("location", { default: "primary" }), orientation: s("orientation", { enum: ["horizontal", "vertical"], enumLabels: ["horizontal", "vertical"], default: "horizontal" }), mobile: b("mobile", { default: true }) }],
  ["search", Search, "none", { placeholder: s("placeholder"), buttonText: s("buttonText") }],
  ["languageSwitcher", Languages, "none", {}],
  ["copyright", Copyright, "none", { text: s("text"), textAlign: align }],
  ["postTitle", Heading1, "none", { level: i("level", { min: 1, max: 6, default: 1 }), link: b("link", { default: false }), textAlign: align }],
  ["postContent", FileText, "none", {}],
  ["postExcerpt", AlignLeft, "none", { moreText: s("moreText") }],
  ["featuredImage", Image, "none", { size: s("size", { enum: ["medium", "medium_large", "large", "full"], default: "large" }), aspect: s("aspect", { enum: ["auto", "16/9", "4/3", "1/1", "3/4"], default: "auto" }), link: b("link", { default: false }) }],
  ["postDate", Calendar, "none", { textAlign: align }],
  ["postAuthor", User, "none", { avatar: b("avatar", { default: false }) }],
  ["postTerms", Tags, "none", { taxonomy: s("taxonomy", { default: "category" }), separator: s("separator", { default: ", " }) }],
  ["comments", MessageSquare, "none", {}],
  ["query", List, "blocks", {
    inherit: b("inherit", { default: true }), postType: s("postType", { default: "post" }), perPage: i("perPage", { min: 1, max: 50, default: 10 }),
    category: s("category"), tag: s("tag"),
    orderBy: s("orderBy", { enum: ["date", "title", "menu_order"], enumLabels: ["date", "title", "menu_order"], default: "date" }),
    order: s("order", { enum: ["desc", "asc"], enumLabels: ["desc", "asc"], default: "desc" }),
  }],
  ["postTemplate", Repeat, "blocks", { layout: s("layout", { enum: ["list", "grid"], enumLabels: ["list", "grid"], default: "list" }), columns: i("columns", { min: 1, max: 6, default: 3 }) }],
  ["pagination", MoreHorizontal, "none", {}],
  ["queryEmpty", ListX, "blocks", {}],
  ["templatePart", PanelTop, "none", { slug: s("slug"), tagName: s("tagName", { enum: ["div", "header", "footer", "aside", "section"], default: "div" }) }],
];

/** Dòng tóm tắt cạnh tên khối (thuộc tính quan trọng nhất) — để nhìn là biết khối đang lấy gì. */
function summary(name: string, t: (k: string) => string) {
  return function Summary({ attrs, children }: BlockEditProps) {
    const fill = (k: string, v: unknown) => t(k).replace("{v}", String(v ?? ""));
    const text = name === "navigation" ? fill("menuSummary", attrs.location ?? "primary")
      : name === "templatePart" ? (attrs.slug ? fill("partSummary", attrs.slug) : "")
      : name === "query" ? (attrs.inherit !== false ? t("inheritSummary") : `${attrs.postType ?? "post"} · ${attrs.perPage ?? 10}`)
      : "";
    return <>{text && <div className="cms-ed-dynamic-summary" contentEditable={false}>{text}</div>}{children}</>;
  };
}

let registered: string | null = null;

/** Đăng ký khối động cho mọi trình soạn (gọi một lần; đổi ngôn ngữ → gọi lại). Mục chèn chỉ hiện khi Editor có `dynamicBlocks`. */
export function registerDynamicBlocks(locale: "vi" | "en" = "vi") {
  if (registered === locale) return;
  registered = locale;
  const dict = locale === "en" ? en : vi;
  const t = (k: string) => dict[k] ?? k;
  for (const [name, icon, content, attributes] of SPECS) {
    const def: BlockDefinition = defineBlock({ name, title: name, keywords: `${vi[name]} ${en[name]}`, content, attributes });
    const initialContent = name === "query"
      ? () => [{ type: "postTemplate", attrs: { layout: "list", columns: 3 }, content: [{ type: "postTitle", attrs: { level: 2, link: true } }, { type: "postExcerpt" }] }, { type: "pagination" }]
      : undefined;
    registerBlock(def, { icon, translate: t, edit: summary(name, t), initialContent });
  }
}

export const DYNAMIC_ICON: LucideIcon = LayoutTemplate;
export const dynamicIcon = (name: string): LucideIcon | undefined => SPECS.find(([n]) => n === name)?.[1] ?? (DYNAMIC_BLOCKS.has(name) ? Globe : undefined);
