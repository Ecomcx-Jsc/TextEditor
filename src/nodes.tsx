import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { FileText, Music, Video as VideoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { viLabels, type EditorLabels } from "./labels";
import { cx } from "./util";
import type { Ask } from "./ask";

/** Ngữ cảnh dùng chung cho node view (chữ giao diện…), đặt bởi component Editor. */
export const EditorContext = Extension.create<unknown, { labels: EditorLabels; ask: Ask; items: unknown[]; inspector: number }>({
  name: "cmsEditorContext",
  addStorage: () => ({ labels: viLabels, ask: async () => null, items: [], inspector: 0 }),
});
export const labelsOf = (editor: Editor): EditorLabels => (editor.storage as any).cmsEditorContext?.labels ?? viLabels;

/** Thuộc tính chỉ lưu trong JSON (không render thành thuộc tính HTML lạ trong trình soạn). */
const dataAttr = (name: string, def: unknown = null) => ({ default: def, renderHTML: () => ({}), parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? def });

/**
 * Ảnh: mediaId, srcset (JPEG + WebP), cỡ, căn lề, chú thích; kéo góc để đổi kích thước hiển thị (giữ tỉ lệ).
 * width/height lưu kích thước hiển thị → theme render ảnh responsive đúng cỡ, không nhảy layout.
 */
export const CmsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: dataAttr("media-id"),
      srcset: { default: null, renderHTML: (a) => (a.srcset ? { srcset: a.srcset } : {}) },
      webpSrcset: dataAttr("webp-srcset"),
      width: { default: null },
      height: { default: null },
      size: dataAttr("size", "large"),
      caption: dataAttr("caption"),
      align: { default: null, renderHTML: (a) => (a.align ? { "data-align": a.align } : {}) },
    };
  },
}).configure({
  inline: false,
  resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 60, minHeight: 40, directions: ["top-left", "top-right", "bottom-left", "bottom-right"] },
});

function Frame({ selected, children, label }: { selected: boolean; children: ReactNode; label: string }) {
  return (
    <NodeViewWrapper className={cx("cms-ed-block", selected && "is-selected")} data-drag-handle>
      <div className="cms-ed-block-label">{label}</div>
      {children}
    </NodeViewWrapper>
  );
}

function GalleryView({ node, selected, updateAttributes, editor }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const images = (node.attrs.images ?? []) as Array<{ src: string; alt?: string }>;
  const cols = node.attrs.columns ?? 3;
  return (
    <Frame selected={selected} label={t.galleryLabel.replace("{n}", String(images.length))}>
      <div className="cms-ed-gallery" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {images.map((im, i) => <img key={i} src={im.src} alt={im.alt ?? ""} />)}
      </div>
      <div className="cms-ed-gallery-cols" contentEditable={false}>
        {t.columns}
        {[2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => updateAttributes({ columns: n })} className={cx(n === cols && "is-active")}>{n}</button>)}
      </div>
    </Frame>
  );
}

export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ images: { default: [] }, columns: { default: 3 }, caption: { default: null } }),
  parseHTML: () => [{ tag: "div[data-gallery]" }],
  renderHTML: () => ["div", mergeAttributes({ "data-gallery": "" })],
  addNodeView: () => ReactNodeViewRenderer(GalleryView),
});

function MediaView({ node, selected, editor }: ReactNodeViewProps) {
  const t = labelsOf(editor);
  const kind = node.type.name;
  return (
    <Frame selected={selected} label={kind === "video" ? t.videoLabel : kind === "audio" ? t.audioLabel : t.fileLabel}>
      {kind === "video" && <video src={node.attrs.src} controls className="cms-ed-video" />}
      {kind === "audio" && <audio src={node.attrs.src} controls className="cms-ed-audio" />}
      {kind === "file" && <div className="cms-ed-file"><FileText size={20} /><span>{node.attrs.name}</span></div>}
      {kind !== "file" && <div className="cms-ed-media-name">{kind === "video" ? <VideoIcon size={12} /> : <Music size={12} />}{node.attrs.name ?? node.attrs.src}</div>}
    </Frame>
  );
}

const mediaNode = (name: "video" | "audio" | "file", extra: Record<string, unknown> = {}) => Node.create({
  name,
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: { default: null }, name: { default: null }, mime: { default: null }, mediaId: { default: null }, caption: { default: null }, ...extra }),
  parseHTML: () => [{ tag: `div[data-${name}]` }],
  renderHTML: ({ HTMLAttributes }) => ["div", { [`data-${name}`]: HTMLAttributes.src ?? "" }],
  addNodeView: () => ReactNodeViewRenderer(MediaView),
});

export const VideoNode = mediaNode("video", { poster: { default: null } });
export const AudioNode = mediaNode("audio");
/** Tệp tải xuống (theme hiển thị PDF ngay trong trang, tệp khác là liên kết tải). */
export const FileNode = mediaNode("file", { size: { default: null }, embed: { default: true } });
