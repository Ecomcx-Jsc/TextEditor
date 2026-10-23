import { Extension, type Editor as TiptapEditor, type Range } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Placeholder } from "@tiptap/extensions";
import { NodeSelection } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Braces, Code, FileText, Heading2, Heading3, Heading4, ImageIcon, Images, Italic, Link2, List,
  ListOrdered, Minus, Music, Pilcrow, Quote, Redo2, SquareCode, Strikethrough, Table2, Underline, Undo2, Video, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { viLabels, type EditorLabels } from "./labels";
import { galleryImage, imageAttrs } from "./media";
import { coreExtensions, knownTypes } from "./extensions";
import { unwrapUnknown, wrapUnknown } from "./unknown";
import { onExtensionsChange, registeredExtensions } from "./registry";
import { DYNAMIC_BLOCKS } from "./dynamic";
import type { EditorExtensionPack, InsertItem, MediaItem, MediaKind, MediaProvider } from "./types";
import { cx } from "./util";
import { rankItems } from "./rank";
export { rankItems } from "./rank";
import { AskPopover, askOf, createAskStore, type Ask } from "./ask";
import { BlockHandle, BlockKeys } from "./handle";
import { BlockSettingsBar, layoutItems } from "./layoutUi";
import { BlockToolbar } from "./toolbar";
import { documentStyleCss, presetsCss } from "./styleattr";
import type { StylePresets } from "@cms/content";
import { registerBasicBlocks } from "./basic";
import { setImagePicker } from "./blocks";

// Bộ khối cơ bản có sẵn ở mọi trình soạn (ứng dụng gọi lại registerBasicBlocks("en") để đổi nhãn)
registerBasicBlocks();
import { cleanPastedHtml, isUrl } from "./paste";
import { handleInsertDrop } from "./inserter";
import { embedInfo } from "@cms/content";

export interface EditorProps {
  /** Nội dung ban đầu (TipTap JSON hoặc HTML). */
  initial: any;
  onChange(json: any): void;
  /** Nguồn media của ứng dụng; không có → chèn ảnh bằng URL. */
  media?: MediaProvider;
  /** Chữ giao diện (mặc định tiếng Việt; có sẵn enLabels). */
  labels?: Partial<EditorLabels>;
  /** Gói mở rộng riêng cho trình soạn này (ngoài các gói đăng ký toàn cục bằng registerEditorExtension). */
  extensions?: EditorExtensionPack[];
  /** Class cho thanh công cụ (vd để dính đầu trang: sticky top). */
  toolbarClassName?: string;
  className?: string;
  /** Nhận đối tượng TipTap Editor để điều khiển từ bên ngoài. */
  onReady?(editor: TiptapEditor): void;
  /** Tên vùng soạn cho trình đọc màn hình (mặc định labels.editorLabel). */
  ariaLabel?: string;
  /** Cho chèn khối động (tên website, menu, danh sách bài…) — Trình dựng, trang dựng bằng khối. Nội dung có sẵn khối động luôn mở được. */
  dynamicBlocks?: boolean;
  /** Preset kiểu dáng của theme (màu, cỡ chữ, khoảng cách, phông) — vùng soạn dùng cùng biến CSS với website. */
  presets?: StylePresets;
}

// ---------------------------------------------------------------------------
// Lệnh chèn mặc định
// ---------------------------------------------------------------------------
const chain = (editor: TiptapEditor, range?: Range) => (range ? editor.chain().focus().deleteRange(range) : editor.chain().focus());

type RequestMedia = (editor: TiptapEditor, kind: MediaKind) => void;

function defaultItems(t: EditorLabels, requestMedia: RequestMedia): InsertItem[] {
  return [
    { key: "p", title: t.paragraph, hint: t.paragraphHint, icon: Pilcrow, keywords: "doan van text paragraph", run: (e, r) => chain(e, r).setParagraph().run() },
    { key: "h2", title: t.h2, hint: "H2", icon: Heading2, keywords: "tieu de heading h2", run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
    { key: "h3", title: t.h3, hint: "H3", icon: Heading3, keywords: "tieu de heading h3", run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
    { key: "h4", title: t.h4, hint: "H4", icon: Heading4, keywords: "tieu de heading h4", run: (e, r) => chain(e, r).setHeading({ level: 4 }).run() },
    { key: "ul", title: t.bulletList, hint: t.bulletListHint, icon: List, keywords: "danh sach list bullet", run: (e, r) => chain(e, r).toggleBulletList().run() },
    { key: "ol", title: t.orderedList, hint: "1. 2. 3.", icon: ListOrdered, keywords: "danh sach so ordered number", run: (e, r) => chain(e, r).toggleOrderedList().run() },
    { key: "quote", title: t.quote, hint: "Blockquote", icon: Quote, keywords: "trich dan quote", run: (e, r) => chain(e, r).toggleBlockquote().run() },
    { key: "code", title: t.codeBlock, hint: "Code block", icon: SquareCode, keywords: "ma code", run: (e, r) => chain(e, r).toggleCodeBlock().run() },
    { key: "image", title: t.image, hint: t.imageHint, icon: ImageIcon, keywords: "anh hinh image photo", run: (e, r) => { chain(e, r).run(); requestMedia(e, "image"); } },
    { key: "gallery", title: t.gallery, hint: t.galleryHint, icon: Images, keywords: "gallery bo suu tap nhieu anh album", run: (e, r) => { chain(e, r).run(); requestMedia(e, "gallery"); } },
    { key: "video", title: t.video, hint: t.videoHint, icon: Video, keywords: "video mp4 phim", run: (e, r) => { chain(e, r).run(); requestMedia(e, "video"); } },
    { key: "audio", title: t.audio, hint: t.audioHint, icon: Music, keywords: "am thanh audio nhac mp3 podcast", run: (e, r) => { chain(e, r).run(); requestMedia(e, "audio"); } },
    { key: "file", title: t.file, hint: t.fileHint, icon: FileText, keywords: "tep file pdf tai xuong download tai lieu", run: (e, r) => { chain(e, r).run(); requestMedia(e, "file"); } },
    { key: "table", title: t.table, hint: t.tableHint, icon: Table2, keywords: "bang table", run: (e, r) => { chain(e, r).run(); insertTableAsk(e, t); } },
    { key: "youtube", title: t.youtube, hint: t.youtubeHint, icon: Video, keywords: "video youtube", run: async (e, r) => {
      chain(e, r).run();
      const res = await askOf(e)({ title: t.youtube, fields: [{ key: "url", label: t.youtubePrompt, type: "url", placeholder: "https://www.youtube.com/watch?v=…" }], submit: t.insert });
      if (res && res !== "remove" && res.url) e.chain().focus().setYoutubeVideo({ src: String(res.url) }).run();
    } },
    ...layoutItems(t),
    { key: "hr", title: t.hr, hint: t.hrHint, icon: Minus, keywords: "duong ke divider hr", run: (e, r) => chain(e, r).setHorizontalRule().run() },
    { key: "shortcode", title: t.shortcode, hint: "[ten-shortcode]", icon: Braces, keywords: "shortcode plugin", run: async (e, r) => {
      chain(e, r).run();
      const res = await askOf(e)({ title: t.shortcode, fields: [{ key: "sc", label: t.shortcodePrompt, placeholder: "contact-form" }], submit: t.insert });
      const sc = res && res !== "remove" ? String(res.sc).trim().replace(/^\[|\]$/g, "") : "";
      if (sc) e.chain().focus().insertContent({ type: "paragraph", content: [{ type: "text", text: `[${sc}]` }] }).run();
    } },
  ];
}

// ---------------------------------------------------------------------------
// Slash menu ("/") — trạng thái riêng cho từng trình soạn
// ---------------------------------------------------------------------------
type SlashState = { props: SuggestionProps<InsertItem> | null; index: number };

function createSlashStore() {
  let state: SlashState = { props: null, index: 0 };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(s: Partial<SlashState>) { state = { ...state, ...s }; listeners.forEach((l) => l()); },
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
type SlashStore = ReturnType<typeof createSlashStore>;

function slashExtension(store: SlashStore, items: () => InsertItem[]) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [Suggestion<InsertItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        allowSpaces: true,
        items: ({ query }) => rankItems(items(), query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => store.set({ props, index: 0 }),
          onUpdate: (props) => store.set({ props, index: 0 }),
          onExit: () => store.set({ props: null, index: 0 }),
          onKeyDown: ({ event }) => {
            const s = store.get();
            const list = s.props?.items ?? [];
            if (list.length === 0) return false;
            if (event.key === "ArrowDown") { store.set({ index: (s.index + 1) % list.length }); return true; }
            if (event.key === "ArrowUp") { store.set({ index: (s.index - 1 + list.length) % list.length }); return true; }
            if (event.key === "Enter") { const it = list[s.index]; if (it) s.props?.command(it); return true; }
            if (event.key === "Escape") { store.set({ props: null }); return true; }
            return false;
          },
        }),
      })];
    },
  });
}

function SlashMenu({ store, t }: { store: SlashStore; t: EditorLabels }) {
  const s = useSyncExternalStore(store.subscribe, store.get);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector(`[data-i="${s.index}"]`)?.scrollIntoView({ block: "nearest" }); }, [s.index]);
  if (!s.props) return null;
  // Đang viết câu có dấu "/" (không còn lệnh phù hợp) → ẩn menu
  if (s.props.items.length === 0 && /\s\S*\s/.test(s.props.query + " ")) return null;
  const rect = s.props.clientRect?.();
  if (!rect) return null;
  return createPortal(
    <div ref={ref} className="cms-ed-slash" style={{ top: Math.min(rect.bottom + 6, window.innerHeight - 320), left: rect.left }}>
      {s.props.items.length === 0 ? <div className="cms-ed-slash-empty">{t.noCommand}</div> : s.props.items.map((it, i) => (
        <button key={it.key} type="button" data-i={i} className={cx("cms-ed-slash-item", i === s.index && "is-active")}
          onMouseDown={(e) => { e.preventDefault(); s.props?.command(it); }} onMouseMove={() => store.get().index !== i && store.set({ index: i })}>
          <span className="cms-ed-slash-icon"><it.icon size={16} /></span>
          <span><span className="cms-ed-slash-title">{it.title}</span><span className="cms-ed-slash-hint">{it.hint}</span></span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Thanh công cụ & menu nổi
// ---------------------------------------------------------------------------
function Btn({ onClick, active, title, children, disabled }: { onClick(): void; active?: boolean; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cx("cms-ed-btn", active && "is-active")}>{children}</button>
  );
}
const Sep = () => <span className="cms-ed-sep" />;

function useMarks(editor: TiptapEditor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      code: e.isActive("code"), link: e.isActive("link"), h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      ul: e.isActive("bulletList"), ol: e.isActive("orderedList"), quote: e.isActive("blockquote"),
      left: e.isActive({ textAlign: "left" }), center: e.isActive({ textAlign: "center" }), right: e.isActive({ textAlign: "right" }),
      table: e.isActive("table"), canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
}

/** Chèn bảng: hỏi số cột × số hàng (mặc định 3 × 3, có hàng tiêu đề). */
async function insertTableAsk(editor: TiptapEditor, t: EditorLabels) {
  const res = await askOf(editor)({
    title: t.table,
    fields: [
      { key: "cols", label: t.tableCols, type: "number", value: "3" },
      { key: "rows", label: t.tableRows, type: "number", value: "3" },
      { key: "header", label: t.headerRow, type: "checkbox", value: true },
    ],
    submit: t.insert,
  });
  if (!res || res === "remove") return;
  const clamp = (v: unknown, d: number) => Math.min(20, Math.max(1, Number(v) || d));
  editor.chain().focus().insertTable({ cols: clamp(res.cols, 3), rows: clamp(res.rows, 3), withHeaderRow: !!res.header }).run();
}

async function setLink(editor: TiptapEditor, t: EditorLabels) {
  const prev = editor.getAttributes("link") as { href?: string; target?: string | null };
  const res = await askOf(editor)({
    title: t.link.replace(/\s*\(.*\)$/, ""),
    fields: [
      { key: "href", label: t.linkPrompt, type: "url", value: prev.href ?? "", placeholder: "https://" },
      { key: "blank", label: t.linkNewTab, type: "checkbox", value: prev.href ? prev.target === "_blank" : false },
    ],
    remove: prev.href ? t.removeLink : undefined,
  });
  if (!res) return;
  const c = editor.chain().focus().extendMarkRange("link");
  const url = res === "remove" ? "" : String(res.href).trim();
  if (url === "") c.unsetLink().run();
  else c.setLink({ href: url, target: res !== "remove" && res.blank ? "_blank" : null }).run();
}

function Toolbar({ editor, t, requestMedia, items }: { editor: TiptapEditor; t: EditorLabels; requestMedia: RequestMedia; items: InsertItem[] }) {
  const s = useMarks(editor);
  const c = () => editor.chain().focus();
  return (
    <div className="cms-ed-toolbar-row">
      <Btn title={t.undo} disabled={!s.canUndo} onClick={() => c().undo().run()}><Undo2 size={16} /></Btn>
      <Btn title={t.redo} disabled={!s.canRedo} onClick={() => c().redo().run()}><Redo2 size={16} /></Btn>
      <Sep />
      <Btn title={t.h2} active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn title={t.h3} active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Btn title={t.bulletList} active={s.ul} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn title={t.orderedList} active={s.ol} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn title={t.quote} active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
      <Sep />
      <Btn title={t.alignLeft} active={s.left} onClick={() => c().setTextAlign("left").run()}><AlignLeft size={16} /></Btn>
      <Btn title={t.alignCenter} active={s.center} onClick={() => c().setTextAlign("center").run()}><AlignCenter size={16} /></Btn>
      <Btn title={t.alignRight} active={s.right} onClick={() => c().setTextAlign("right").run()}><AlignRight size={16} /></Btn>
      <Sep />
      <Btn title={t.insertImage} onClick={() => requestMedia(editor, "image")}><ImageIcon size={16} /></Btn>
      <Btn title={t.gallery} onClick={() => requestMedia(editor, "gallery")}><Images size={16} /></Btn>
      <Btn title={t.insertTable} active={s.table} onClick={() => insertTableAsk(editor, t)}><Table2 size={16} /></Btn>
      <Btn title={t.insertVideo} onClick={() => items.find((x) => x.key === "youtube")?.run(editor)}><Video size={16} /></Btn>
      {s.table && (
        <span className="cms-ed-table-tools">
          {([[t.addRow, () => c().addRowAfter().run()], [t.addCol, () => c().addColumnAfter().run()], [t.delRow, () => c().deleteRow().run()], [t.delCol, () => c().deleteColumn().run()]] as const).map(([l, f]) => (
            <button key={l} type="button" onClick={f}>{l}</button>
          ))}
          <button type="button" className="is-danger" onClick={() => c().deleteTable().run()}>{t.delTable}</button>
        </span>
      )}
      <span className="cms-ed-hint">{t.slashHint}</span>
    </div>
  );
}

function SelectionMenu({ editor, t }: { editor: TiptapEditor; t: EditorLabels }) {
  const s = useMarks(editor);
  const c = () => editor.chain().focus();
  return (
    <BubbleMenu editor={editor} shouldShow={({ editor: e, from, to }) => from !== to && !(e.state.selection instanceof NodeSelection) && !e.isActive("codeBlock")} className="cms-ed-bubble">
      <Btn title={t.bold} active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn title={t.italic} active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn title={t.underline} active={s.underline} onClick={() => c().toggleUnderline().run()}><Underline size={16} /></Btn>
      <Btn title={t.strike} active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      <Btn title={t.code} active={s.code} onClick={() => c().toggleCode().run()}><Code size={16} /></Btn>
      <Sep />
      <Btn title={t.link} active={s.link} onClick={() => setLink(editor, t)}><Link2 size={16} /></Btn>
      <Sep />
      <Btn title={t.h2} active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn title={t.h3} active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Btn title={t.quote} active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
    </BubbleMenu>
  );
}

/** CSS kiểu dáng khối (attrs.style) của bài — cùng CSS với website. */
function DocumentStyles({ editor, presets }: { editor: TiptapEditor; presets?: StylePresets }) {
  const css = presetsCss(presets) + useEditorState({ editor, selector: ({ editor: e }) => documentStyleCss(e) });
  return css ? <style data-ecx-styles="">{css}</style> : null;
}

/** Đếm từ / ký tự / thời gian đọc (200 từ mỗi phút) — dưới vùng soạn. */
function Stats({ editor, t }: { editor: TiptapEditor; t: EditorLabels }) {
  const s = useEditorState({ editor, selector: ({ editor: e }) => {
    const text = e.state.doc.textBetween(0, e.state.doc.content.size, "\n", "\n");
    const words = text.split(/\s+/).filter(Boolean).length;
    return { words, chars: text.replace(/\n/g, "").length };
  } });
  const fmt = (tpl: string, n: number) => tpl.replace("{n}", n.toLocaleString());
  return (
    <div className="cms-ed-stats" aria-label={t.stats}>
      <span>{fmt(t.words, s.words)}</span><span>{fmt(t.chars, s.chars)}</span>{s.words > 0 && <span>{fmt(t.readingTime, Math.max(1, Math.round(s.words / 200)))}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
/** Trình soạn nội dung. Dùng kèm CSS: import "@cms/editor/style.css". */
const NO_PACKS: EditorExtensionPack[] = [];

export function Editor({ initial, onChange, media, labels, extensions: localPacks = NO_PACKS, toolbarClassName, className, onReady, ariaLabel, dynamicBlocks = false, presets }: EditorProps) {
  const t = useMemo(() => ({ ...viLabels, ...labels }), [labels]);
  const slash = useMemo(createSlashStore, []);
  const globalPacks = useSyncExternalStore(onExtensionsChange, registeredExtensions);
  const packs = useMemo(() => [...globalPacks, ...localPacks], [globalPacks, localPacks]);
  const mediaRef = useRef(media); mediaRef.current = media;
  const asker = useMemo(createAskStore, []);
  const [menuRequest, setMenuRequest] = useState(0);
  const editorRef = useRef<TiptapEditor | null>(null);

  // Chọn media → chèn node phù hợp. Không có MediaProvider: ảnh/video nhập bằng URL.
  const requestMedia: RequestMedia = async (editor, kind) => {
    const provider = mediaRef.current;
    let list: MediaItem[] = [];
    if (provider) list = await provider.pick({ kind, multiple: kind === "gallery" });
    else {
      const res = await asker.ask({ title: kind === "video" ? t.video : t.image, fields: [{ key: "url", label: t.imageUrlPrompt, type: "url", placeholder: "https://" }], submit: t.insert });
      const url = res && res !== "remove" ? String(res.url).trim() : "";
      if (url) list = [{ id: url, url, mimeType: kind === "video" ? "video/mp4" : "image/*", fileName: url.split("/").pop() ?? url }];
    }
    if (!list.length) return;
    const m = list[0];
    const c = editor.chain().focus();
    switch (kind) {
      case "image": editor.isActive("image") ? c.updateAttributes("image", { ...imageAttrs(m), align: editor.getAttributes("image").align }).run() : c.insertContent({ type: "image", attrs: imageAttrs(m) }).run(); break;
      case "gallery": c.insertContent({ type: "gallery", attrs: { images: list.map(galleryImage), columns: Math.min(4, Math.max(2, list.length)) } }).run(); break;
      case "video": c.insertContent({ type: "video", attrs: { src: m.url, name: m.fileName, mime: m.mimeType, mediaId: m.id } }).run(); break;
      case "audio": c.insertContent({ type: "audio", attrs: { src: m.url, name: m.fileName, mime: m.mimeType, mediaId: m.id } }).run(); break;
      case "file": c.insertContent({ type: "file", attrs: { src: m.url, name: m.title || m.fileName, mime: m.mimeType, mediaId: m.id, size: m.size } }).run(); break;
    }
  };
  const items = useMemo(() => [...defaultItems(t, requestMedia), ...packs.flatMap((p) => p.insertItems ?? [])]
    .filter((i) => dynamicBlocks || !(i.key.startsWith("block:") && DYNAMIC_BLOCKS.has(i.key.slice(6)))), [t, packs, dynamicBlocks]);
  const itemsRef = useRef(items); itemsRef.current = items;

  const editor = useEditor({
    extensions: [
      ...coreExtensions(),
      Placeholder.configure({ placeholder: ({ node }) => (node.type.name === "heading" ? t.headingPlaceholder : t.placeholder), showOnlyCurrent: true }),
      slashExtension(slash, () => itemsRef.current),
      BlockKeys.configure({ openMenu: () => setMenuRequest((n) => n + 1) }),
      ...packs.flatMap((p) => p.extensions ?? []),
    ],
    // Khối / định dạng lạ (plugin đã tắt) được bọc giữ nguyên thay vì làm trình soạn báo lỗi
    content: initial && typeof initial === "object" ? wrapUnknown(initial, knownTypes(packs.flatMap((p) => p.extensions ?? []))) : initial || "",
    onUpdate: ({ editor: e }) => onChange(unwrapUnknown(e.getJSON() as any)),
    editorProps: {
      // Vùng soạn là ô nhập nhiều dòng có tên (axe: aria-input-field-name)
      attributes: { class: "cms-ed-content ecx-content", role: "textbox", "aria-multiline": "true", "aria-label": ariaLabel ?? t.editorLabel },
      // Dán từ Word / Google Docs: bỏ style, font, màu, thẻ Office; danh sách Word thành danh sách thật
      transformPastedHTML: (html) => cleanPastedHtml(html),
      // Dán một đường dẫn của nhà cung cấp hỗ trợ vào dòng trống → khối nhúng
      // Thả một khối từ trình chèn (cột trái của ứng dụng)
      handleDrop: (view, event): boolean => !!editorRef.current && handleInsertDrop(editorRef.current, view, event as DragEvent),
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const { $from, empty } = view.state.selection;
        if (!empty || !isUrl(text) || $from.parent.type.name !== "paragraph" || $from.parent.content.size > 0 || !embedInfo(text.trim())) return false;
        const node = view.state.schema.nodes.embed.create({ url: text.trim() });
        view.dispatch(view.state.tr.replaceWith($from.before(), $from.after(), node).scrollIntoView());
        return true;
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && editor) { event.preventDefault(); event.stopPropagation(); setLink(editor, t); return true; }
        return false;
      },
    },
    immediatelyRender: true,
  }, [packs.map((p) => p.name).join(",")]);

  editorRef.current = editor;
  useEffect(() => {
    if (!editor) return;
    const ctx = (editor.storage as any).cmsEditorContext as { labels: EditorLabels; ask: Ask };
    ctx.labels = t; ctx.ask = asker.ask;
    (ctx as any).setLink = () => setLink(editor, t);
    // Điều khiển "media" trong form cài đặt khối: chọn từ thư viện của ứng dụng, không có thì nhập URL
    setImagePicker(async () => {
      const provider = mediaRef.current;
      if (provider) { const [m] = await provider.pick({ kind: "image", multiple: false }); return m ? { url: m.url, id: m.id, alt: m.alt } : null; }
      const r = await asker.ask({ title: t.image, fields: [{ key: "url", label: t.imageUrlPrompt, type: "url", placeholder: "https://" }], submit: t.insert });
      return r && r !== "remove" && String(r.url).trim() ? { url: String(r.url).trim() } : null;
    });
    onReady?.(editor);
  }, [editor, t]);
  // Lệnh chèn (gồm khối plugin) cho trình chèn ở ngoài trình soạn (BlockInserter); giao dịch rỗng để nó đọc lại
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    (editor.storage as any).cmsEditorContext.items = items;
    editor.view.dispatch(editor.state.tr.setMeta("cmsItems", true));
  }, [editor, items]);

  return (
    <div className={cx("cms-editor", className)}>
      {editor && <div className={cx("cms-ed-toolbar", toolbarClassName)}><Toolbar editor={editor} t={t} requestMedia={requestMedia} items={items} /></div>}
      {editor && <SelectionMenu editor={editor} t={t} />}
      {editor && <DocumentStyles editor={editor} presets={presets} />}
      <EditorContent editor={editor} />
      <SlashMenu store={slash} t={t} />
      {editor && <BlockHandle editor={editor} t={t} menuRequest={menuRequest} />}
      {editor && <AskPopover store={asker} editor={editor} t={t} />}
      {editor && <BlockSettingsBar editor={editor} t={t} />}
      {editor && <BlockToolbar editor={editor} t={t} media={media} requestMedia={requestMedia} />}
      {editor && <Stats editor={editor} t={t} />}
    </div>
  );
}
